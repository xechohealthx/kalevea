import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import type { ServiceContext } from "@/server/services/service-context";
import {
  attachDocumentToParent,
  createNote,
  createStatusEvent,
  listActivityForParent,
} from "@/server/services/workflow/workflow.service";
import { calculateCaseVariance } from "@/server/services/reimbursement/variance.service";

import type { ClaimStatus, ReimbursementStatus } from "./reimbursement.types";
import { ReimbursementParentTypes } from "./reimbursement.types";

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) return 0;
  return Number(value.toString());
}

function nextStatusFromClaimStatus(status: ClaimStatus): ReimbursementStatus | null {
  if (status === "SUBMITTED" || status === "ACCEPTED") return "SUBMITTED";
  if (status === "PENDING") return "PENDING_PAYMENT";
  if (status === "DENIED") return "DENIED";
  if (status === "REJECTED") return "CLAIM_DRAFT";
  return null;
}

async function ensureAnyReadAccess(userId: string) {
  const access = await getAccessSnapshot(userId);
  const firstClinicId = access.accessibleClinicIds[0];
  if (!firstClinicId && access.globalRoleKeys.length === 0) {
    throw new AppError("No clinic access", "UNAUTHORIZED", 403);
  }
  if (access.globalRoleKeys.length > 0) {
    await requirePermission(userId, Permissions.reimbursement.read, { scope: "GLOBAL" });
  } else {
    await requirePermission(userId, Permissions.reimbursement.read, { scope: "CLINIC", clinicId: firstClinicId });
  }
  return access;
}

async function requireClinicPermission(
  userId: string,
  clinicId: string,
  permission:
    | "reimbursement.read"
    | "reimbursement.manage"
    | "claims.read"
    | "claims.manage",
) {
  const mapping = {
    "reimbursement.read": Permissions.reimbursement.read,
    "reimbursement.manage": Permissions.reimbursement.manage,
    "claims.read": Permissions.claims.read,
    "claims.manage": Permissions.claims.manage,
  } as const;
  await requirePermission(userId, mapping[permission], { scope: "CLINIC", clinicId });
}

async function getCaseCore(caseId: string) {
  const value = await prisma.reimbursementCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      organizationId: true,
      clinicId: true,
      buyAndBillCaseId: true,
      priorAuthorizationCaseId: true,
      patientReferenceId: true,
      payerName: true,
      expectedAmount: true,
      expectedAllowedAmount: true,
      underpaymentFlag: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!value) throw new AppError("Reimbursement case not found", "NOT_FOUND", 404);
  return value;
}

export async function calculateReimbursementVariance(ctx: ServiceContext, caseId: string) {
  const core = await getCaseCore(caseId);
  await requireClinicPermission(ctx.actorUserId, core.clinicId, "reimbursement.read");

  const aggregate = await prisma.paymentRecord.aggregate({
    where: { reimbursementCaseId: core.id },
    _sum: { paidAmount: true },
  });

  const metrics = calculateCaseVariance({
    expectedAmount: decimalToNumber(core.expectedAmount),
    expectedAllowedAmount: decimalToNumber(core.expectedAllowedAmount),
    totalPaid: decimalToNumber(aggregate._sum.paidAmount),
  });

  return {
    expectedAmount: metrics.expectedAmount,
    expectedAllowedAmount: metrics.expectedAllowedAmount,
    totalPaid: metrics.totalPaid,
    variance: metrics.varianceAmount,
    varianceAmount: metrics.varianceAmount,
    variancePercentage: metrics.variancePercentage,
    underpaymentFlag: metrics.underpaymentFlag,
  };
}

export async function listReimbursementCases(
  ctx: ServiceContext,
  input?: { clinicId?: string; status?: ReimbursementStatus; limit?: number },
) {
  const access = await ensureAnyReadAccess(ctx.actorUserId);
  const hasGlobal = access.globalRoleKeys.length > 0;

  if (input?.clinicId) {
    await requireClinicPermission(ctx.actorUserId, input.clinicId, "reimbursement.read");
  }

  const cases = await prisma.reimbursementCase.findMany({
    where: {
      clinicId: input?.clinicId ?? (hasGlobal ? undefined : { in: access.accessibleClinicIds }),
      status: input?.status,
    },
    include: {
      clinic: { select: { id: true, name: true } },
      buyAndBillCase: { select: { id: true, status: true } },
      priorAuthorizationCase: { select: { id: true, status: true } },
      claims: {
        select: { id: true, status: true, submittedAt: true, payerName: true, billedAmount: true },
        orderBy: [{ createdAt: "desc" }],
        take: 5,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: input?.limit ?? 50,
  });

  const paymentSums = await prisma.paymentRecord.groupBy({
    by: ["reimbursementCaseId"],
    where: { reimbursementCaseId: { in: cases.map((c) => c.id) } },
    _sum: { paidAmount: true },
  });
  const sumMap = new Map(paymentSums.map((r) => [r.reimbursementCaseId, decimalToNumber(r._sum.paidAmount)]));

  return cases.map((c) => {
    const metrics = calculateCaseVariance({
      expectedAmount: decimalToNumber(c.expectedAmount),
      expectedAllowedAmount: decimalToNumber(c.expectedAllowedAmount),
      totalPaid: sumMap.get(c.id) ?? 0,
    });
    return {
      ...c,
      expectedAmount: metrics.expectedAmount,
      expectedAllowedAmount: metrics.expectedAllowedAmount,
      totalPaid: metrics.totalPaid,
      variance: metrics.varianceAmount,
      varianceAmount: metrics.varianceAmount,
      variancePercentage: metrics.variancePercentage,
      underpaymentFlag: c.underpaymentFlag || metrics.underpaymentFlag,
    };
  });
}

export async function getReimbursementCase(ctx: ServiceContext, caseId: string) {
  const core = await getCaseCore(caseId);
  await requireClinicPermission(ctx.actorUserId, core.clinicId, "reimbursement.read");

  const [statusEvents, claims, payments, attachments, activity, variance] = await Promise.all([
    prisma.reimbursementStatusEvent.findMany({
      where: { reimbursementCaseId: core.id },
      include: { changedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ changedAt: "desc" }],
    }),
    prisma.claimRecord.findMany({
      where: { reimbursementCaseId: core.id },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.paymentRecord.findMany({
      where: { reimbursementCaseId: core.id },
      orderBy: [{ paidDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.fileAttachment.findMany({
      where: { parentType: ReimbursementParentTypes.case, parentId: core.id },
      include: {
        document: { select: { id: true, title: true, category: true, mimeType: true, fileSize: true, createdAt: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    listActivityForParent(ctx, {
      organizationId: core.organizationId,
      clinicId: core.clinicId,
      parentType: ReimbursementParentTypes.case,
      parentId: core.id,
    }),
    calculateReimbursementVariance(ctx, core.id),
  ]);

  return { ...core, statusEvents, claims, payments, attachments, activity, ...variance };
}

export async function createReimbursementCase(
  ctx: ServiceContext,
  input: {
    clinicId: string;
    buyAndBillCaseId?: string;
    priorAuthorizationCaseId?: string;
    patientReferenceId?: string;
    payerName: string;
    expectedAmount: number;
    expectedAllowedAmount?: number;
    initialNote?: string;
    documentIds?: string[];
  },
) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: input.clinicId },
    select: { id: true, organizationId: true },
  });
  if (!clinic) throw new AppError("Clinic not found", "NOT_FOUND", 404);
  await requireClinicPermission(ctx.actorUserId, clinic.id, "reimbursement.manage");

  if (input.buyAndBillCaseId) {
    const bnb = await prisma.buyAndBillCase.findUnique({
      where: { id: input.buyAndBillCaseId },
      select: { id: true, organizationId: true, clinicId: true },
    });
    if (!bnb) throw new AppError("Buy-and-bill case not found", "NOT_FOUND", 404);
    if (bnb.organizationId !== clinic.organizationId || bnb.clinicId !== clinic.id) {
      throw new AppError("Buy-and-bill case is outside clinic scope", "UNAUTHORIZED", 403);
    }
  }

  if (input.priorAuthorizationCaseId) {
    const pa = await prisma.priorAuthorizationCase.findUnique({
      where: { id: input.priorAuthorizationCaseId },
      select: { id: true, organizationId: true, clinicId: true },
    });
    if (!pa) throw new AppError("Prior authorization case not found", "NOT_FOUND", 404);
    if (pa.organizationId !== clinic.organizationId || pa.clinicId !== clinic.id) {
      throw new AppError("Prior authorization case is outside clinic scope", "UNAUTHORIZED", 403);
    }
  }

  const created = await prisma.reimbursementCase.create({
    data: {
      organizationId: clinic.organizationId,
      clinicId: clinic.id,
      buyAndBillCaseId: input.buyAndBillCaseId ?? null,
      priorAuthorizationCaseId: input.priorAuthorizationCaseId ?? null,
      patientReferenceId: input.patientReferenceId ?? null,
      payerName: input.payerName,
      expectedAmount: new Prisma.Decimal(input.expectedAmount),
      expectedAllowedAmount:
        input.expectedAllowedAmount !== undefined ? new Prisma.Decimal(input.expectedAllowedAmount) : null,
      underpaymentFlag: true,
      status: "EXPECTED",
      createdByUserId: ctx.actorUserId,
    },
  });

  await prisma.reimbursementStatusEvent.create({
    data: {
      reimbursementCaseId: created.id,
      organizationId: clinic.organizationId,
      clinicId: clinic.id,
      fromStatus: null,
      toStatus: "EXPECTED",
      changedByUserId: ctx.actorUserId,
      note: "Reimbursement case created",
    },
  });

  await createStatusEvent(
    ctx,
    {
      organizationId: clinic.organizationId,
      clinicId: clinic.id,
      parentType: ReimbursementParentTypes.case,
      parentId: created.id,
      fromStatus: null,
      toStatus: "EXPECTED",
      note: "Reimbursement case created",
    },
    { permission: Permissions.reimbursement.manage },
  );

  if (input.initialNote) {
    await createNote(
      ctx,
      {
        organizationId: clinic.organizationId,
        clinicId: clinic.id,
        parentType: ReimbursementParentTypes.case,
        parentId: created.id,
        body: input.initialNote,
      },
      { permission: Permissions.reimbursement.manage },
    );
  }

  for (const documentId of input.documentIds ?? []) {
    await attachDocumentToParent(
      ctx,
      {
        organizationId: clinic.organizationId,
        clinicId: clinic.id,
        parentType: ReimbursementParentTypes.case,
        parentId: created.id,
        documentId,
      },
      { permission: Permissions.reimbursement.manage },
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: clinic.organizationId, clinicId: clinic.id },
    action: "CREATE",
    entityType: "ReimbursementCase",
    entityId: created.id,
    organizationId: clinic.organizationId,
    clinicId: clinic.id,
    metadata: {
      status: created.status,
      expectedAmount: created.expectedAmount.toString(),
      buyAndBillCaseId: created.buyAndBillCaseId,
      priorAuthorizationCaseId: created.priorAuthorizationCaseId,
    },
  });
  logger.info("Reimbursement case created", { organizationId: clinic.organizationId, clinicId: clinic.id });

  return getReimbursementCase(ctx, created.id);
}

export async function updateReimbursementStatus(
  ctx: ServiceContext,
  caseId: string,
  input: { status: ReimbursementStatus; note?: string; documentIds?: string[] },
) {
  const existing = await getCaseCore(caseId);
  await requireClinicPermission(ctx.actorUserId, existing.clinicId, "reimbursement.manage");

  const fromStatus = existing.status;
  const toStatus = input.status;
  if (fromStatus !== toStatus) {
    await prisma.reimbursementCase.update({
      where: { id: existing.id },
      data: { status: toStatus },
    });
    await prisma.reimbursementStatusEvent.create({
      data: {
        reimbursementCaseId: existing.id,
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        fromStatus,
        toStatus,
        changedByUserId: ctx.actorUserId,
        note: input.note ?? null,
      },
    });
    await createStatusEvent(
      ctx,
      {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        parentType: ReimbursementParentTypes.case,
        parentId: existing.id,
        fromStatus,
        toStatus,
        note: input.note ?? null,
      },
      { permission: Permissions.reimbursement.manage },
    );
  }

  for (const documentId of input.documentIds ?? []) {
    await attachDocumentToParent(
      ctx,
      {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        parentType: ReimbursementParentTypes.case,
        parentId: existing.id,
        documentId,
      },
      { permission: Permissions.reimbursement.manage },
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: existing.organizationId, clinicId: existing.clinicId },
    action: "UPDATE",
    entityType: "ReimbursementCase",
    entityId: existing.id,
    organizationId: existing.organizationId,
    clinicId: existing.clinicId,
    metadata: { fromStatus, toStatus },
  });
  logger.info("Reimbursement status changed", { clinicId: existing.clinicId, fromStatus, toStatus });

  return getCaseCore(existing.id);
}

export async function createClaimRecord(
  ctx: ServiceContext,
  caseId: string,
  input: {
    externalClaimId?: string;
    claimNumber?: string;
    payerName: string;
    submittedAt?: Date;
    status?: ClaimStatus;
    billedAmount?: number;
    notes?: string;
    documentIds?: string[];
  },
) {
  const existing = await getCaseCore(caseId);
  await requireClinicPermission(ctx.actorUserId, existing.clinicId, "claims.manage");

  let caseStatusFrom: ReimbursementStatus | null = null;
  let caseStatusTo: ReimbursementStatus | null = null;

  const claim = await prisma.$transaction(async (tx) => {
    const created = await tx.claimRecord.create({
      data: {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        reimbursementCaseId: existing.id,
        externalClaimId: input.externalClaimId ?? null,
        claimNumber: input.claimNumber ?? null,
        payerName: input.payerName,
        submittedAt: input.submittedAt ?? null,
        status: input.status ?? "DRAFT",
        billedAmount: input.billedAmount !== undefined ? new Prisma.Decimal(input.billedAmount) : null,
        notes: input.notes ?? null,
        statusChangedByUserId: ctx.actorUserId,
      },
    });

    const targetStatus =
      created.status === "SUBMITTED" || created.status === "ACCEPTED"
        ? "SUBMITTED"
        : created.status === "PENDING"
          ? "PENDING_PAYMENT"
          : "CLAIM_DRAFT";

    if (existing.status !== targetStatus) {
      await tx.reimbursementCase.update({
        where: { id: existing.id },
        data: { status: targetStatus },
      });
      await tx.reimbursementStatusEvent.create({
        data: {
          reimbursementCaseId: existing.id,
          organizationId: existing.organizationId,
          clinicId: existing.clinicId,
          fromStatus: existing.status,
          toStatus: targetStatus,
          changedByUserId: ctx.actorUserId,
          note: "Claim record created",
        },
      });
      caseStatusFrom = existing.status;
      caseStatusTo = targetStatus;
    }
    return created;
  });

  if (caseStatusFrom && caseStatusTo) {
    await createStatusEvent(
      ctx,
      {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        parentType: ReimbursementParentTypes.case,
        parentId: existing.id,
        fromStatus: caseStatusFrom,
        toStatus: caseStatusTo,
        note: "Claim record created",
      },
      { permission: Permissions.reimbursement.manage },
    );
  }

  await createStatusEvent(
    ctx,
    {
      organizationId: existing.organizationId,
      clinicId: existing.clinicId,
      parentType: ReimbursementParentTypes.claim,
      parentId: claim.id,
      fromStatus: null,
      toStatus: claim.status,
      note: "Claim record created",
    },
    { permission: Permissions.claims.manage },
  );

  for (const documentId of input.documentIds ?? []) {
    await attachDocumentToParent(
      ctx,
      {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        parentType: ReimbursementParentTypes.claim,
        parentId: claim.id,
        documentId,
      },
      { permission: Permissions.claims.manage },
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: existing.organizationId, clinicId: existing.clinicId },
    action: "CREATE",
    entityType: "ClaimRecord",
    entityId: claim.id,
    organizationId: existing.organizationId,
    clinicId: existing.clinicId,
    metadata: { reimbursementCaseId: existing.id, status: claim.status },
  });
  logger.info("Claim record created", { clinicId: existing.clinicId, reimbursementCaseId: existing.id });

  return claim;
}

export async function updateClaimRecordStatus(
  ctx: ServiceContext,
  claimId: string,
  input: { status: ClaimStatus; note?: string },
) {
  const existingClaim = await prisma.claimRecord.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      organizationId: true,
      clinicId: true,
      reimbursementCaseId: true,
      status: true,
    },
  });
  if (!existingClaim) throw new AppError("Claim record not found", "NOT_FOUND", 404);
  await requireClinicPermission(ctx.actorUserId, existingClaim.clinicId, "claims.manage");

  let caseStatusFrom: ReimbursementStatus | null = null;
  let caseStatusTo: ReimbursementStatus | null = null;

  const updatedClaim = await prisma.$transaction(async (tx) => {
    const updated = await tx.claimRecord.update({
      where: { id: existingClaim.id },
      data: {
        status: input.status,
        statusChangedByUserId: ctx.actorUserId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    const reimbursementCase = await tx.reimbursementCase.findUnique({
      where: { id: existingClaim.reimbursementCaseId },
      select: { id: true, status: true },
    });
    if (!reimbursementCase) throw new AppError("Reimbursement case not found", "NOT_FOUND", 404);

    const mapped = nextStatusFromClaimStatus(input.status);
    if (mapped && mapped !== reimbursementCase.status) {
      await tx.reimbursementCase.update({
        where: { id: reimbursementCase.id },
        data: { status: mapped },
      });
      await tx.reimbursementStatusEvent.create({
        data: {
          reimbursementCaseId: reimbursementCase.id,
          organizationId: existingClaim.organizationId,
          clinicId: existingClaim.clinicId,
          fromStatus: reimbursementCase.status,
          toStatus: mapped,
          changedByUserId: ctx.actorUserId,
          note: `Claim status updated to ${input.status}`,
        },
      });
      caseStatusFrom = reimbursementCase.status;
      caseStatusTo = mapped;
    }

    return updated;
  });

  await createStatusEvent(
    ctx,
    {
      organizationId: existingClaim.organizationId,
      clinicId: existingClaim.clinicId,
      parentType: ReimbursementParentTypes.claim,
      parentId: existingClaim.id,
      fromStatus: existingClaim.status,
      toStatus: updatedClaim.status,
      note: input.note ?? null,
    },
    { permission: Permissions.claims.manage },
  );

  if (caseStatusFrom && caseStatusTo) {
    await createStatusEvent(
      ctx,
      {
        organizationId: existingClaim.organizationId,
        clinicId: existingClaim.clinicId,
        parentType: ReimbursementParentTypes.case,
        parentId: existingClaim.reimbursementCaseId,
        fromStatus: caseStatusFrom,
        toStatus: caseStatusTo,
        note: `Claim status updated to ${input.status}`,
      },
      { permission: Permissions.reimbursement.manage },
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: existingClaim.organizationId, clinicId: existingClaim.clinicId },
    action: "UPDATE",
    entityType: "ClaimRecord",
    entityId: existingClaim.id,
    organizationId: existingClaim.organizationId,
    clinicId: existingClaim.clinicId,
    metadata: { fromStatus: existingClaim.status, toStatus: updatedClaim.status },
  });
  logger.info("Claim status changed", { clinicId: existingClaim.clinicId, claimId: existingClaim.id });

  return updatedClaim;
}

export async function createPaymentRecord(
  ctx: ServiceContext,
  caseId: string,
  input: {
    claimRecordId?: string;
    paidAmount: number;
    paidDate: Date;
    sourceType: "MANUAL" | "ERA_IMPORTED" | "OTHER";
    referenceNumber?: string;
    notes?: string;
    documentIds?: string[];
  },
) {
  const existing = await getCaseCore(caseId);
  await requireClinicPermission(ctx.actorUserId, existing.clinicId, "reimbursement.manage");

  if (input.claimRecordId) {
    const claim = await prisma.claimRecord.findUnique({
      where: { id: input.claimRecordId },
      select: { id: true, reimbursementCaseId: true, clinicId: true },
    });
    if (!claim) throw new AppError("Claim record not found", "NOT_FOUND", 404);
    if (claim.reimbursementCaseId !== existing.id || claim.clinicId !== existing.clinicId) {
      throw new AppError("Claim record is outside reimbursement case scope", "UNAUTHORIZED", 403);
    }
  }

  let caseStatusFrom: ReimbursementStatus | null = null;
  let caseStatusTo: ReimbursementStatus | null = null;

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.paymentRecord.create({
      data: {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        reimbursementCaseId: existing.id,
        claimRecordId: input.claimRecordId ?? null,
        paidAmount: new Prisma.Decimal(input.paidAmount),
        paidDate: input.paidDate,
        sourceType: input.sourceType,
        referenceNumber: input.referenceNumber ?? null,
        notes: input.notes ?? null,
      },
    });

    const aggregate = await tx.paymentRecord.aggregate({
      where: { reimbursementCaseId: existing.id },
      _sum: { paidAmount: true },
    });
    const totalPaid = decimalToNumber(aggregate._sum.paidAmount);
    const metrics = calculateCaseVariance({
      expectedAmount: decimalToNumber(existing.expectedAmount),
      expectedAllowedAmount: decimalToNumber(existing.expectedAllowedAmount),
      totalPaid,
    });
    const targetStatus: ReimbursementStatus =
      totalPaid >= metrics.expectedAmount ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : existing.status;

    if (targetStatus !== existing.status) {
      await tx.reimbursementCase.update({
        where: { id: existing.id },
        data: { status: targetStatus, underpaymentFlag: metrics.underpaymentFlag },
      });
      await tx.reimbursementStatusEvent.create({
        data: {
          reimbursementCaseId: existing.id,
          organizationId: existing.organizationId,
          clinicId: existing.clinicId,
          fromStatus: existing.status,
          toStatus: targetStatus,
          changedByUserId: ctx.actorUserId,
          note: "Payment recorded",
        },
      });
      caseStatusFrom = existing.status;
      caseStatusTo = targetStatus;
    } else {
      await tx.reimbursementCase.update({
        where: { id: existing.id },
        data: { underpaymentFlag: metrics.underpaymentFlag },
      });
    }

    return created;
  });

  if (caseStatusFrom && caseStatusTo) {
    await createStatusEvent(
      ctx,
      {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        parentType: ReimbursementParentTypes.case,
        parentId: existing.id,
        fromStatus: caseStatusFrom,
        toStatus: caseStatusTo,
        note: "Payment recorded",
      },
      { permission: Permissions.reimbursement.manage },
    );
  }

  await createStatusEvent(
    ctx,
    {
      organizationId: existing.organizationId,
      clinicId: existing.clinicId,
      parentType: ReimbursementParentTypes.payment,
      parentId: payment.id,
      fromStatus: null,
      toStatus: input.sourceType,
      note: "Payment recorded",
    },
    { permission: Permissions.reimbursement.manage },
  );

  for (const documentId of input.documentIds ?? []) {
    await attachDocumentToParent(
      ctx,
      {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        parentType: ReimbursementParentTypes.payment,
        parentId: payment.id,
        documentId,
      },
      { permission: Permissions.reimbursement.manage },
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: existing.organizationId, clinicId: existing.clinicId },
    action: "CREATE",
    entityType: "PaymentRecord",
    entityId: payment.id,
    organizationId: existing.organizationId,
    clinicId: existing.clinicId,
    metadata: {
      reimbursementCaseId: existing.id,
      paidAmount: payment.paidAmount.toString(),
      sourceType: payment.sourceType,
    },
  });
  logger.info("Payment recorded", { clinicId: existing.clinicId, reimbursementCaseId: existing.id });

  return payment;
}
