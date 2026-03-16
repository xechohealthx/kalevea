import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import type { ServiceContext } from "@/server/services/service-context";
import {
  attachDocumentToParent,
  createNote,
  createStatusEvent,
  listActivityForParent,
} from "@/server/services/workflow/workflow.service";

import type { PriorAuthStatus } from "./prior-auth.types";
import { PriorAuthParentTypes } from "./prior-auth.types";

async function getCaseOrThrow(caseId: string) {
  const paCase = await prisma.priorAuthorizationCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      organizationId: true,
      clinicId: true,
      status: true,
      payerName: true,
      medicationName: true,
      patientReferenceId: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!paCase) throw new AppError("Prior authorization case not found", "NOT_FOUND", 404);
  return paCase;
}

async function ensureAnyReadAccess(userId: string) {
  const access = await getAccessSnapshot(userId);
  const firstClinicId = access.accessibleClinicIds[0];
  if (!firstClinicId && access.globalRoleKeys.length === 0) {
    throw new AppError("No clinic access", "UNAUTHORIZED", 403);
  }
  if (access.globalRoleKeys.length > 0) {
    await requirePermission(userId, Permissions.priorAuth.read, { scope: "GLOBAL" });
  } else {
    await requirePermission(userId, Permissions.priorAuth.read, { scope: "CLINIC", clinicId: firstClinicId });
  }
  return access;
}

export async function createPACase(
  ctx: ServiceContext,
  input: {
    clinicId: string;
    payerName: string;
    medicationName: string;
    patientReferenceId?: string;
    initialNote?: string;
    documentIds?: string[];
  },
) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: input.clinicId },
    select: { id: true, organizationId: true },
  });
  if (!clinic) throw new AppError("Clinic not found", "NOT_FOUND", 404);

  await requirePermission(ctx.actorUserId, Permissions.priorAuth.manage, {
    scope: "CLINIC",
    clinicId: clinic.id,
  });

  const paCase = await prisma.priorAuthorizationCase.create({
    data: {
      organizationId: clinic.organizationId,
      clinicId: clinic.id,
      payerName: input.payerName,
      medicationName: input.medicationName,
      patientReferenceId: input.patientReferenceId ?? null,
      status: "DRAFT",
      createdByUserId: ctx.actorUserId,
    },
  });

  await prisma.priorAuthorizationStatusEvent.create({
    data: {
      priorAuthorizationCaseId: paCase.id,
      organizationId: clinic.organizationId,
      clinicId: clinic.id,
      fromStatus: null,
      toStatus: "DRAFT",
      note: "Case created",
      changedByUserId: ctx.actorUserId,
    },
  });

  await createStatusEvent(
    ctx,
    {
      organizationId: clinic.organizationId,
      clinicId: clinic.id,
      parentType: PriorAuthParentTypes.case,
      parentId: paCase.id,
      fromStatus: null,
      toStatus: "DRAFT",
      note: "Case created",
    },
    { permission: Permissions.priorAuth.manage },
  );

  if (input.initialNote) {
    await createNote(
      ctx,
      {
        organizationId: clinic.organizationId,
        clinicId: clinic.id,
        parentType: PriorAuthParentTypes.case,
        parentId: paCase.id,
        body: input.initialNote,
      },
      { permission: Permissions.priorAuth.manage },
    );
  }

  for (const documentId of input.documentIds ?? []) {
    await attachDocumentToParent(
      ctx,
      {
        organizationId: clinic.organizationId,
        clinicId: clinic.id,
        parentType: PriorAuthParentTypes.case,
        parentId: paCase.id,
        documentId,
      },
      { permission: Permissions.priorAuth.manage },
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: clinic.organizationId, clinicId: clinic.id },
    action: "CREATE",
    entityType: "PriorAuthorizationCase",
    entityId: paCase.id,
    organizationId: clinic.organizationId,
    clinicId: clinic.id,
    metadata: {
      status: paCase.status,
      payerName: paCase.payerName,
      medicationName: paCase.medicationName,
      documentCount: input.documentIds?.length ?? 0,
    },
  });

  return getPACase(ctx, paCase.id);
}

export async function updatePAStatus(
  ctx: ServiceContext,
  caseId: string,
  input: {
    status: PriorAuthStatus;
    note?: string;
    documentIds?: string[];
  },
) {
  const existing = await getCaseOrThrow(caseId);
  await requirePermission(ctx.actorUserId, Permissions.priorAuth.manage, {
    scope: "CLINIC",
    clinicId: existing.clinicId,
  });

  const fromStatus = existing.status;
  const toStatus = input.status;

  const updatedCase =
    fromStatus === toStatus
      ? existing
      : await prisma.priorAuthorizationCase.update({
          where: { id: existing.id },
          data: { status: toStatus },
          select: {
            id: true,
            organizationId: true,
            clinicId: true,
            status: true,
            payerName: true,
            medicationName: true,
            patientReferenceId: true,
            createdByUserId: true,
            createdAt: true,
            updatedAt: true,
          },
        });

  if (fromStatus !== toStatus) {
    await prisma.priorAuthorizationStatusEvent.create({
      data: {
        priorAuthorizationCaseId: existing.id,
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        fromStatus,
        toStatus,
        note: input.note ?? null,
        changedByUserId: ctx.actorUserId,
      },
    });

    await createStatusEvent(
      ctx,
      {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        parentType: PriorAuthParentTypes.case,
        parentId: existing.id,
        fromStatus,
        toStatus,
        note: input.note ?? null,
      },
      { permission: Permissions.priorAuth.manage },
    );
  }

  for (const documentId of input.documentIds ?? []) {
    await attachDocumentToParent(
      ctx,
      {
        organizationId: existing.organizationId,
        clinicId: existing.clinicId,
        parentType: PriorAuthParentTypes.case,
        parentId: existing.id,
        documentId,
      },
      { permission: Permissions.priorAuth.manage },
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: existing.organizationId, clinicId: existing.clinicId },
    action: "UPDATE",
    entityType: "PriorAuthorizationCase",
    entityId: existing.id,
    organizationId: existing.organizationId,
    clinicId: existing.clinicId,
    metadata: {
      fromStatus,
      toStatus,
      documentCount: input.documentIds?.length ?? 0,
    },
  });

  return updatedCase;
}

export async function listPACases(
  ctx: ServiceContext,
  input?: {
    clinicId?: string;
    status?: PriorAuthStatus;
    limit?: number;
  },
) {
  const access = await ensureAnyReadAccess(ctx.actorUserId);
  const hasGlobal = access.globalRoleKeys.length > 0;

  if (input?.clinicId) {
    await requirePermission(ctx.actorUserId, Permissions.priorAuth.read, {
      scope: "CLINIC",
      clinicId: input.clinicId,
    });
  }

  return prisma.priorAuthorizationCase.findMany({
    where: {
      clinicId: input?.clinicId ?? (hasGlobal ? undefined : { in: access.accessibleClinicIds }),
      status: input?.status,
    },
    include: {
      clinic: { select: { id: true, name: true } },
      statusEvents: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: input?.limit ?? 50,
  });
}

export async function getPACase(ctx: ServiceContext, caseId: string) {
  const paCase = await getCaseOrThrow(caseId);
  await requirePermission(ctx.actorUserId, Permissions.priorAuth.read, {
    scope: "CLINIC",
    clinicId: paCase.clinicId,
  });

  const [statusEvents, attachments, activity] = await Promise.all([
    prisma.priorAuthorizationStatusEvent.findMany({
      where: { priorAuthorizationCaseId: paCase.id },
      include: { changedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.fileAttachment.findMany({
      where: { parentType: PriorAuthParentTypes.case, parentId: paCase.id },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            category: true,
            mimeType: true,
            fileSize: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    listActivityForParent(ctx, {
      organizationId: paCase.organizationId,
      clinicId: paCase.clinicId,
      parentType: PriorAuthParentTypes.case,
      parentId: paCase.id,
    }),
  ]);

  return { ...paCase, statusEvents, attachments, activity };
}
