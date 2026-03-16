import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import type { ServiceContext } from "@/server/services/service-context";

import { createPaymentRecord, updateClaimRecordStatus } from "./reimbursement.service";

async function requireReconciliationPermissions(ctx: ServiceContext, clinicId: string) {
  await requirePermission(ctx.actorUserId, Permissions.era.manage, { scope: "CLINIC", clinicId });
  await requirePermission(ctx.actorUserId, Permissions.reimbursement.manage, { scope: "CLINIC", clinicId });
  await requirePermission(ctx.actorUserId, Permissions.claims.manage, { scope: "CLINIC", clinicId });
}

async function findClaimForRemittancePayment(input: {
  clinicId: string;
  claimReference: string | null;
  payerClaimControlNumber: string | null;
}) {
  const refs = [input.claimReference, input.payerClaimControlNumber].filter(
    (v): v is string => Boolean(v && v.trim().length > 0),
  );
  if (refs.length === 0) return null;

  return prisma.claimRecord.findFirst({
    where: {
      clinicId: input.clinicId,
      OR: [{ claimNumber: { in: refs } }, { externalClaimId: { in: refs } }],
    },
    select: {
      id: true,
      status: true,
      billedAmount: true,
      reimbursementCaseId: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

async function computeFileReconciliationStatus(remittanceFileId: string) {
  const [total, matched] = await Promise.all([
    prisma.remittancePayment.count({ where: { remittanceFileId } }),
    prisma.remittancePayment.count({ where: { remittanceFileId, reconciliationStatus: "MATCHED" } }),
  ]);

  if (total === 0 || matched === 0) return "UNMATCHED" as const;
  if (matched < total) return "PARTIALLY_MATCHED" as const;
  return "MATCHED" as const;
}

export async function reconcileRemittanceFile(ctx: ServiceContext, remittanceFileId: string) {
  const file = await prisma.remittanceFile.findUnique({
    where: { id: remittanceFileId },
    include: {
      payments: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });
  if (!file) throw new AppError("Remittance file not found", "NOT_FOUND", 404);

  await requireReconciliationPermissions(ctx, file.clinicId);

  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const remittancePayment of file.payments) {
    if (remittancePayment.paymentRecordId) {
      matchedCount += 1;
      continue;
    }

    const claim = await findClaimForRemittancePayment({
      clinicId: file.clinicId,
      claimReference: remittancePayment.claimReference,
      payerClaimControlNumber: remittancePayment.payerClaimControlNumber,
    });

    if (!claim) {
      unmatchedCount += 1;
      await prisma.remittancePayment.update({
        where: { id: remittancePayment.id },
        data: {
          reconciliationStatus: "UNMATCHED",
        },
      });
      continue;
    }

    const payment = await createPaymentRecord(ctx, claim.reimbursementCaseId, {
      claimRecordId: claim.id,
      paidAmount: Number(remittancePayment.paidAmount.toString()),
      paidDate: file.paymentDate ?? new Date(),
      sourceType: "ERA_IMPORTED",
      referenceNumber:
        remittancePayment.claimReference ?? remittancePayment.payerClaimControlNumber ?? undefined,
      notes: `Auto-created from remittance file ${file.id}`,
    });

    const claimPaidAgg = await prisma.paymentRecord.aggregate({
      where: { claimRecordId: claim.id },
      _sum: { paidAmount: true },
    });
    const claimPaidTotal = Number(claimPaidAgg._sum.paidAmount?.toString() ?? "0");
    const billedAmount = Number(claim.billedAmount?.toString() ?? "0");

    if (billedAmount > 0 && claimPaidTotal >= billedAmount) {
      await updateClaimRecordStatus(ctx, claim.id, {
        status: "PAID",
        note: "Marked paid by ERA reconciliation",
      });
    } else {
      await updateClaimRecordStatus(ctx, claim.id, {
        status: "PENDING",
        note: "Updated by ERA reconciliation",
      });
    }

    await prisma.remittancePayment.update({
      where: { id: remittancePayment.id },
      data: {
        reconciliationStatus: "MATCHED",
        matchedClaimRecordId: claim.id,
        matchedReimbursementCaseId: claim.reimbursementCaseId,
        paymentRecordId: payment.id,
      },
    });

    matchedCount += 1;
  }

  const fileStatus = await computeFileReconciliationStatus(file.id);

  await prisma.remittanceFile.update({
    where: { id: file.id },
    data: {
      reconciliationStatus: fileStatus,
      processedByUserId: ctx.actorUserId,
    },
  });

  logger.info("ERA reconciliation completed", {
    clinicId: file.clinicId,
    remittanceFileId: file.id,
    matchedCount,
    unmatchedCount,
    status: fileStatus,
  });

  return {
    remittanceFileId: file.id,
    reconciliationStatus: fileStatus,
    matchedCount,
    unmatchedCount,
    totalPayments: file.payments.length,
  };
}
