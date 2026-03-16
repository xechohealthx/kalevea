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

import type { BuyAndBillStatus } from "./buy-and-bill.types";
import { BuyAndBillParentTypes } from "./buy-and-bill.types";

async function ensureAnyReadAccess(userId: string) {
  const access = await getAccessSnapshot(userId);
  const firstClinicId = access.accessibleClinicIds[0];
  if (!firstClinicId && access.globalRoleKeys.length === 0) {
    throw new AppError("No clinic access", "UNAUTHORIZED", 403);
  }
  if (access.globalRoleKeys.length > 0) {
    await requirePermission(userId, Permissions.buyAndBill.read, { scope: "GLOBAL" });
  } else {
    await requirePermission(userId, Permissions.buyAndBill.read, { scope: "CLINIC", clinicId: firstClinicId });
  }
  return access;
}

async function requireClinicPermission(
  userId: string,
  clinicId: string,
  permission: "buyAndBill.read" | "buyAndBill.manage" | "inventory.read" | "inventory.manage",
) {
  const mapping = {
    "buyAndBill.read": Permissions.buyAndBill.read,
    "buyAndBill.manage": Permissions.buyAndBill.manage,
    "inventory.read": Permissions.inventory.read,
    "inventory.manage": Permissions.inventory.manage,
  } as const;
  await requirePermission(userId, mapping[permission], { scope: "CLINIC", clinicId });
}

async function getCaseCore(caseId: string) {
  const value = await prisma.buyAndBillCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      organizationId: true,
      clinicId: true,
      medicationCatalogItemId: true,
      status: true,
      patientReferenceId: true,
      expectedPayerName: true,
      expectedReimbursementAmount: true,
      priorAuthorizationCaseId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!value) throw new AppError("Buy-and-bill case not found", "NOT_FOUND", 404);
  return value;
}

export async function listBuyAndBillCases(
  ctx: ServiceContext,
  input?: {
    clinicId?: string;
    status?: BuyAndBillStatus;
    limit?: number;
  },
) {
  const access = await ensureAnyReadAccess(ctx.actorUserId);
  const hasGlobal = access.globalRoleKeys.length > 0;

  if (input?.clinicId) {
    await requireClinicPermission(ctx.actorUserId, input.clinicId, "buyAndBill.read");
  }

  return prisma.buyAndBillCase.findMany({
    where: {
      clinicId: input?.clinicId ?? (hasGlobal ? undefined : { in: access.accessibleClinicIds }),
      status: input?.status,
    },
    include: {
      clinic: { select: { id: true, name: true } },
      medicationCatalogItem: { select: { id: true, name: true, ndc: true, hcpcsCode: true } },
      priorAuthorizationCase: { select: { id: true, status: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: input?.limit ?? 50,
  });
}

export async function getBuyAndBillCase(ctx: ServiceContext, caseId: string) {
  const core = await getCaseCore(caseId);
  await requireClinicPermission(ctx.actorUserId, core.clinicId, "buyAndBill.read");

  const [statusEvents, attachments, administrations, activity] = await Promise.all([
    prisma.buyAndBillStatusEvent.findMany({
      where: { buyAndBillCaseId: core.id },
      include: { changedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ changedAt: "desc" }],
    }),
    prisma.fileAttachment.findMany({
      where: { parentType: BuyAndBillParentTypes.case, parentId: core.id },
      include: {
        document: { select: { id: true, title: true, category: true, mimeType: true, fileSize: true, createdAt: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.medicationAdministrationEvent.findMany({
      where: { buyAndBillCaseId: core.id },
      include: {
        medicationLot: {
          select: {
            id: true,
            lotNumber: true,
            quantityRemaining: true,
            quantityReceived: true,
            expirationDate: true,
          },
        },
        administeredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: [{ administeredAt: "desc" }],
    }),
    listActivityForParent(ctx, {
      organizationId: core.organizationId,
      clinicId: core.clinicId,
      parentType: BuyAndBillParentTypes.case,
      parentId: core.id,
    }),
  ]);

  return { ...core, statusEvents, attachments, administrations, activity };
}

export async function createBuyAndBillCase(
  ctx: ServiceContext,
  input: {
    clinicId: string;
    patientReferenceId?: string;
    medicationCatalogItemId: string;
    priorAuthorizationCaseId?: string;
    expectedReimbursementAmount?: number;
    expectedPayerName?: string;
    initialNote?: string;
    documentIds?: string[];
  },
) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: input.clinicId },
    select: { id: true, organizationId: true },
  });
  if (!clinic) throw new AppError("Clinic not found", "NOT_FOUND", 404);

  await requireClinicPermission(ctx.actorUserId, clinic.id, "buyAndBill.manage");

  const med = await prisma.medicationCatalogItem.findUnique({
    where: { id: input.medicationCatalogItemId },
    select: { id: true, organizationId: true, isActive: true },
  });
  if (!med || !med.isActive) throw new AppError("Medication catalog item not found", "NOT_FOUND", 404);
  if (med.organizationId && med.organizationId !== clinic.organizationId) {
    throw new AppError("Medication catalog item is outside clinic organization scope", "UNAUTHORIZED", 403);
  }

  if (input.priorAuthorizationCaseId) {
    const paCase = await prisma.priorAuthorizationCase.findUnique({
      where: { id: input.priorAuthorizationCaseId },
      select: { id: true, clinicId: true },
    });
    if (!paCase) throw new AppError("Prior authorization case not found", "NOT_FOUND", 404);
    if (paCase.clinicId !== clinic.id) {
      throw new AppError("Prior authorization case is outside clinic scope", "UNAUTHORIZED", 403);
    }
  }

  const created = await prisma.buyAndBillCase.create({
    data: {
      organizationId: clinic.organizationId,
      clinicId: clinic.id,
      patientReferenceId: input.patientReferenceId ?? null,
      medicationCatalogItemId: input.medicationCatalogItemId,
      priorAuthorizationCaseId: input.priorAuthorizationCaseId ?? null,
      status: "DRAFT",
      expectedReimbursementAmount:
        input.expectedReimbursementAmount !== undefined
          ? new Prisma.Decimal(input.expectedReimbursementAmount)
          : null,
      expectedPayerName: input.expectedPayerName ?? null,
      createdByUserId: ctx.actorUserId,
    },
  });

  await prisma.buyAndBillStatusEvent.create({
    data: {
      buyAndBillCaseId: created.id,
      organizationId: clinic.organizationId,
      clinicId: clinic.id,
      fromStatus: null,
      toStatus: "DRAFT",
      changedByUserId: ctx.actorUserId,
      note: "Case created",
    },
  });

  await createStatusEvent(
    ctx,
    {
      organizationId: clinic.organizationId,
      clinicId: clinic.id,
      parentType: BuyAndBillParentTypes.case,
      parentId: created.id,
      fromStatus: null,
      toStatus: "DRAFT",
      note: "Case created",
    },
    { permission: Permissions.buyAndBill.manage },
  );

  if (input.initialNote) {
    await createNote(
      ctx,
      {
        organizationId: clinic.organizationId,
        clinicId: clinic.id,
        parentType: BuyAndBillParentTypes.case,
        parentId: created.id,
        body: input.initialNote,
      },
      { permission: Permissions.buyAndBill.manage },
    );
  }

  for (const documentId of input.documentIds ?? []) {
    await attachDocumentToParent(
      ctx,
      {
        organizationId: clinic.organizationId,
        clinicId: clinic.id,
        parentType: BuyAndBillParentTypes.case,
        parentId: created.id,
        documentId,
      },
      { permission: Permissions.buyAndBill.manage },
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: clinic.organizationId, clinicId: clinic.id },
    action: "CREATE",
    entityType: "BuyAndBillCase",
    entityId: created.id,
    organizationId: clinic.organizationId,
    clinicId: clinic.id,
    metadata: {
      status: created.status,
      medicationCatalogItemId: created.medicationCatalogItemId,
      priorAuthorizationCaseId: created.priorAuthorizationCaseId,
    },
  });
  logger.info("Buy-and-bill case created", { organizationId: clinic.organizationId, clinicId: clinic.id });

  return getBuyAndBillCase(ctx, created.id);
}

export async function updateBuyAndBillStatus(
  ctx: ServiceContext,
  caseId: string,
  input: { status: BuyAndBillStatus; note?: string; documentIds?: string[] },
) {
  const existing = await getCaseCore(caseId);
  await requireClinicPermission(ctx.actorUserId, existing.clinicId, "buyAndBill.manage");

  const fromStatus = existing.status;
  const toStatus = input.status;
  if (fromStatus !== toStatus) {
    await prisma.buyAndBillCase.update({
      where: { id: existing.id },
      data: { status: toStatus },
    });
    await prisma.buyAndBillStatusEvent.create({
      data: {
        buyAndBillCaseId: existing.id,
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
        parentType: BuyAndBillParentTypes.case,
        parentId: existing.id,
        fromStatus,
        toStatus,
        note: input.note ?? null,
      },
      { permission: Permissions.buyAndBill.manage },
    );
  }

  for (const documentId of input.documentIds ?? []) {
    await attachDocumentToParent(
      ctx,
      {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        parentType: BuyAndBillParentTypes.case,
        parentId: existing.id,
        documentId,
      },
      { permission: Permissions.buyAndBill.manage },
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: existing.organizationId, clinicId: existing.clinicId },
    action: "UPDATE",
    entityType: "BuyAndBillCase",
    entityId: existing.id,
    organizationId: existing.organizationId,
    clinicId: existing.clinicId,
    metadata: { fromStatus, toStatus },
  });
  logger.info("Buy-and-bill status changed", {
    clinicId: existing.clinicId,
    fromStatus,
    toStatus,
  });

  return getCaseCore(existing.id);
}

export async function listMedicationLots(
  ctx: ServiceContext,
  input?: {
    clinicId?: string;
    medicationCatalogItemId?: string;
    includeDepleted?: boolean;
    limit?: number;
  },
) {
  const access = await ensureAnyReadAccess(ctx.actorUserId);
  const hasGlobal = access.globalRoleKeys.length > 0;

  if (input?.clinicId) {
    await requireClinicPermission(ctx.actorUserId, input.clinicId, "inventory.read");
  }

  return prisma.medicationLot.findMany({
    where: {
      clinicId: input?.clinicId ?? (hasGlobal ? undefined : { in: access.accessibleClinicIds }),
      medicationCatalogItemId: input?.medicationCatalogItemId,
      ...(input?.includeDepleted ? {} : { quantityRemaining: { gt: 0 } }),
    },
    include: {
      clinic: { select: { id: true, name: true } },
      medicationCatalogItem: { select: { id: true, name: true, ndc: true, hcpcsCode: true } },
    },
    orderBy: [{ acquisitionDate: "desc" }],
    take: input?.limit ?? 50,
  });
}

export async function createMedicationLot(
  ctx: ServiceContext,
  input: {
    clinicId: string;
    medicationCatalogItemId: string;
    lotNumber: string;
    expirationDate: Date;
    quantityReceived: number;
    acquisitionDate: Date;
    supplierName?: string;
    invoiceReference?: string;
    documentIds?: string[];
  },
) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: input.clinicId },
    select: { id: true, organizationId: true },
  });
  if (!clinic) throw new AppError("Clinic not found", "NOT_FOUND", 404);
  await requireClinicPermission(ctx.actorUserId, clinic.id, "inventory.manage");

  const med = await prisma.medicationCatalogItem.findUnique({
    where: { id: input.medicationCatalogItemId },
    select: { id: true, organizationId: true, isActive: true },
  });
  if (!med || !med.isActive) throw new AppError("Medication catalog item not found", "NOT_FOUND", 404);
  if (med.organizationId && med.organizationId !== clinic.organizationId) {
    throw new AppError("Medication catalog item is outside clinic organization scope", "UNAUTHORIZED", 403);
  }

  const lot = await prisma.medicationLot.create({
    data: {
      organizationId: clinic.organizationId,
      clinicId: clinic.id,
      medicationCatalogItemId: input.medicationCatalogItemId,
      lotNumber: input.lotNumber,
      expirationDate: input.expirationDate,
      quantityReceived: input.quantityReceived,
      quantityRemaining: input.quantityReceived,
      acquisitionDate: input.acquisitionDate,
      supplierName: input.supplierName ?? null,
      invoiceReference: input.invoiceReference ?? null,
    },
  });

  for (const documentId of input.documentIds ?? []) {
    await attachDocumentToParent(
      ctx,
      {
        organizationId: clinic.organizationId,
        clinicId: clinic.id,
        parentType: BuyAndBillParentTypes.lot,
        parentId: lot.id,
        documentId,
      },
      { permission: Permissions.inventory.manage },
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: clinic.organizationId, clinicId: clinic.id },
    action: "CREATE",
    entityType: "MedicationLot",
    entityId: lot.id,
    organizationId: clinic.organizationId,
    clinicId: clinic.id,
    metadata: {
      medicationCatalogItemId: lot.medicationCatalogItemId,
      quantityReceived: lot.quantityReceived,
      quantityRemaining: lot.quantityRemaining,
    },
  });
  logger.info("Medication lot created", { organizationId: clinic.organizationId, clinicId: clinic.id });

  return lot;
}

export async function recordMedicationAdministration(
  ctx: ServiceContext,
  caseId: string,
  input: {
    medicationLotId: string;
    administeredAt: Date;
    unitsAdministered: number;
    notes?: string;
    documentIds?: string[];
  },
) {
  const existing = await getCaseCore(caseId);
  await requireClinicPermission(ctx.actorUserId, existing.clinicId, "buyAndBill.manage");
  await requireClinicPermission(ctx.actorUserId, existing.clinicId, "inventory.manage");

  const result = await prisma.$transaction(async (tx) => {
    const lot = await tx.medicationLot.findUnique({
      where: { id: input.medicationLotId },
      select: {
        id: true,
        organizationId: true,
        clinicId: true,
        medicationCatalogItemId: true,
        quantityRemaining: true,
      },
    });
    if (!lot) throw new AppError("Medication lot not found", "NOT_FOUND", 404);
    if (lot.organizationId !== existing.organizationId || lot.clinicId !== existing.clinicId) {
      throw new AppError("Medication lot is outside case scope", "UNAUTHORIZED", 403);
    }
    if (lot.medicationCatalogItemId !== existing.medicationCatalogItemId) {
      throw new AppError("Medication lot does not match case medication", "CONFLICT", 409);
    }
    if (lot.quantityRemaining < input.unitsAdministered) {
      logger.warn("Medication administration rejected due to insufficient quantity", {
        clinicId: existing.clinicId,
        buyAndBillCaseId: existing.id,
        medicationLotId: lot.id,
      });
      throw new AppError("Units administered exceed lot quantity remaining", "VALIDATION_ERROR", 400, {
        code: "INSUFFICIENT_LOT_QUANTITY",
      });
    }

    const updatedLots = await tx.medicationLot.updateMany({
      where: {
        id: lot.id,
        quantityRemaining: { gte: input.unitsAdministered },
      },
      data: {
        quantityRemaining: { decrement: input.unitsAdministered },
      },
    });
    if (updatedLots.count !== 1) {
      logger.warn("Medication administration race prevented by quantity guard", {
        clinicId: existing.clinicId,
        buyAndBillCaseId: existing.id,
        medicationLotId: lot.id,
      });
      throw new AppError("Unable to reserve medication quantity. Retry.", "CONFLICT", 409);
    }

    const administration = await tx.medicationAdministrationEvent.create({
      data: {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        buyAndBillCaseId: existing.id,
        medicationLotId: lot.id,
        administeredAt: input.administeredAt,
        administeredByUserId: ctx.actorUserId,
        unitsAdministered: input.unitsAdministered,
        notes: input.notes ?? null,
      },
    });

    let statusChanged = false;
    if (existing.status !== "ADMINISTERED") {
      await tx.buyAndBillCase.update({
        where: { id: existing.id },
        data: { status: "ADMINISTERED" },
      });
      await tx.buyAndBillStatusEvent.create({
        data: {
          buyAndBillCaseId: existing.id,
          organizationId: existing.organizationId,
          clinicId: existing.clinicId,
          fromStatus: existing.status,
          toStatus: "ADMINISTERED",
          changedByUserId: ctx.actorUserId,
          note: "Medication administered",
        },
      });
      statusChanged = true;
    }

    return { administration, statusChanged, fromStatus: existing.status };
  });

  for (const documentId of input.documentIds ?? []) {
    await attachDocumentToParent(
      ctx,
      {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        parentType: BuyAndBillParentTypes.administration,
        parentId: result.administration.id,
        documentId,
      },
      { permission: Permissions.buyAndBill.manage },
    );
  }

  if (result.statusChanged) {
    await createStatusEvent(
      ctx,
      {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        parentType: BuyAndBillParentTypes.case,
        parentId: existing.id,
        fromStatus: result.fromStatus,
        toStatus: "ADMINISTERED",
        note: "Medication administered",
      },
      { permission: Permissions.buyAndBill.manage },
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: existing.organizationId, clinicId: existing.clinicId },
    action: "CREATE",
    entityType: "MedicationAdministrationEvent",
    entityId: result.administration.id,
    organizationId: existing.organizationId,
    clinicId: existing.clinicId,
    metadata: {
      buyAndBillCaseId: existing.id,
      medicationLotId: result.administration.medicationLotId,
      unitsAdministered: result.administration.unitsAdministered,
    },
  });
  logger.info("Medication administration recorded", {
    clinicId: existing.clinicId,
    buyAndBillCaseId: existing.id,
  });

  return result.administration;
}
