import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import {
  finalizeDocumentUpload,
  requestDocumentUploadUrl,
} from "@/server/services/documents/document.service";
import { readObjectAsText } from "@/server/services/storage/s3.service";
import type { ServiceContext } from "@/server/services/service-context";
import { reconcileRemittanceFile } from "@/server/services/reimbursement/reconciliation.service";

import { parseEra835 } from "./era-parser.service";

async function requireClinicPermission(
  userId: string,
  clinicId: string,
  permission: "read" | "manage",
) {
  await requirePermission(
    userId,
    permission === "read" ? Permissions.era.read : Permissions.era.manage,
    { scope: "CLINIC", clinicId },
  );
}

export async function requestEraUpload(
  ctx: ServiceContext,
  input: {
    clinicId: string;
    filename: string;
    mimeType: string;
    size: number;
    checksumSha256?: string;
    title?: string;
  },
) {
  await requireClinicPermission(ctx.actorUserId, input.clinicId, "manage");
  const clinic = await prisma.clinic.findUnique({
    where: { id: input.clinicId },
    select: { organizationId: true },
  });
  if (!clinic) throw new AppError("Clinic not found", "NOT_FOUND", 404);

  return requestDocumentUploadUrl(ctx, {
    clinicId: input.clinicId,
    organizationId: clinic.organizationId,
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.size,
    checksumSha256: input.checksumSha256,
    category: "ERA_REMITTANCE",
    title: input.title ?? `ERA 835 - ${new Date().toISOString().slice(0, 10)}`,
  });
}

export async function processEraUpload(
  ctx: ServiceContext,
  input: {
    clinicId: string;
    storageKey: string;
    mimeType: string;
    fileSize: number;
    checksumSha256?: string;
    title?: string;
  },
) {
  await requireClinicPermission(ctx.actorUserId, input.clinicId, "manage");
  const clinic = await prisma.clinic.findUnique({
    where: { id: input.clinicId },
    select: { organizationId: true },
  });
  if (!clinic) throw new AppError("Clinic not found", "NOT_FOUND", 404);

  const document = await finalizeDocumentUpload(ctx, {
    clinicId: input.clinicId,
    organizationId: clinic.organizationId,
    storageKey: input.storageKey,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    checksumSha256: input.checksumSha256,
    category: "ERA_REMITTANCE",
    title: input.title ?? `ERA 835 - ${new Date().toISOString().slice(0, 10)}`,
  });

  const existing = await prisma.remittanceFile.findUnique({
    where: { documentId: document.id },
    select: { id: true },
  });
  if (existing) {
    return getEraFile(ctx, existing.id);
  }

  const eraText = await readObjectAsText({ storageKey: document.storageKey });
  const parsed = parseEra835(eraText);

  const totalAmount =
    parsed.totalAmount > 0
      ? parsed.totalAmount
      : parsed.payments.reduce((acc, p) => acc + p.paidAmount, 0);

  const remittanceFile = await prisma.remittanceFile.create({
    data: {
      organizationId: clinic.organizationId,
      clinicId: input.clinicId,
      documentId: document.id,
      payerName: parsed.payerName,
      paymentDate: parsed.paymentDate,
      totalAmount,
      reconciliationStatus: "UNMATCHED",
      processedByUserId: ctx.actorUserId,
      payments: {
        create: parsed.payments.map((p) => ({
          claimReference: p.claimReference,
          payerClaimControlNumber: p.payerClaimControlNumber,
          paidAmount: p.paidAmount,
          adjustmentAmount: p.adjustmentAmount,
          cacCodes: p.cacCodes,
          renderingNpi: parsed.npi,
          billingTaxId: parsed.taxId,
          reconciliationStatus: "UNMATCHED",
        })),
      },
    },
    include: {
      payments: true,
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: clinic.organizationId, clinicId: input.clinicId },
    action: "CREATE",
    entityType: "RemittanceFile",
    entityId: remittanceFile.id,
    organizationId: clinic.organizationId,
    clinicId: input.clinicId,
    metadata: {
      paymentCount: remittanceFile.payments.length,
      totalAmount,
    },
  });

  logger.info("ERA file parsed", {
    clinicId: input.clinicId,
    remittanceFileId: remittanceFile.id,
    paymentCount: remittanceFile.payments.length,
  });

  const reconciliation = await reconcileRemittanceFile(ctx, remittanceFile.id);
  const full = await getEraFile(ctx, remittanceFile.id);

  return {
    ...full,
    reconciliation,
  };
}

export async function listEraFiles(ctx: ServiceContext, input?: { clinicId?: string; limit?: number }) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const hasGlobal = access.globalRoleKeys.length > 0;
  const targetClinicId = input?.clinicId ?? access.accessibleClinicIds[0];

  if (!targetClinicId && !hasGlobal) {
    throw new AppError("No clinic access", "UNAUTHORIZED", 403);
  }
  if (targetClinicId) {
    await requireClinicPermission(ctx.actorUserId, targetClinicId, "read");
  } else {
    await requirePermission(ctx.actorUserId, Permissions.era.read, { scope: "GLOBAL" });
  }

  return prisma.remittanceFile.findMany({
    where: {
      clinicId: input?.clinicId ?? (hasGlobal ? undefined : { in: access.accessibleClinicIds }),
    },
    include: {
      document: { select: { id: true, title: true, createdAt: true } },
      payments: {
        select: {
          id: true,
          paidAmount: true,
          adjustmentAmount: true,
          reconciliationStatus: true,
          claimReference: true,
        },
      },
      clinic: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: input?.limit ?? 50,
  });
}

export async function getEraFile(ctx: ServiceContext, fileId: string) {
  const file = await prisma.remittanceFile.findUnique({
    where: { id: fileId },
    include: {
      document: { select: { id: true, title: true, createdAt: true } },
      payments: {
        include: {
          matchedClaimRecord: {
            select: { id: true, claimNumber: true, externalClaimId: true, status: true },
          },
          matchedReimbursementCase: {
            select: { id: true, status: true, expectedAmount: true },
          },
          paymentRecord: {
            select: { id: true, paidAmount: true, paidDate: true, sourceType: true },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
      clinic: { select: { id: true, name: true } },
    },
  });
  if (!file) throw new AppError("Remittance file not found", "NOT_FOUND", 404);

  await requireClinicPermission(ctx.actorUserId, file.clinicId, "read");
  return file;
}
