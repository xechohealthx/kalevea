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
  calculateCaseVariance,
  calculateClinicVariance,
  calculatePayerVariance,
} from "@/server/services/reimbursement/variance.service";

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) return 0;
  return Number(value.toString());
}

async function resolveAnalyticsScope(ctx: ServiceContext, clinicId?: string) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const hasGlobal = access.globalRoleKeys.length > 0;

  if (clinicId) {
    await requirePermission(ctx.actorUserId, Permissions.analytics.read, { scope: "CLINIC", clinicId });
    return { hasGlobal, clinicIds: [clinicId], access };
  }

  if (hasGlobal) {
    await requirePermission(ctx.actorUserId, Permissions.analytics.read, { scope: "GLOBAL" });
    return { hasGlobal, clinicIds: [] as string[], access };
  }

  const firstClinicId = access.accessibleClinicIds[0];
  if (!firstClinicId) throw new AppError("No clinic access", "UNAUTHORIZED", 403);
  await requirePermission(ctx.actorUserId, Permissions.analytics.read, { scope: "CLINIC", clinicId: firstClinicId });
  return { hasGlobal, clinicIds: access.accessibleClinicIds, access };
}

export async function getNetworkReimbursementSummary(
  ctx: ServiceContext,
  input?: { clinicId?: string },
) {
  const scope = await resolveAnalyticsScope(ctx, input?.clinicId);

  const cases = await prisma.reimbursementCase.findMany({
    where: {
      clinicId: input?.clinicId ?? (scope.hasGlobal ? undefined : { in: scope.clinicIds }),
    },
    select: {
      id: true,
      expectedAmount: true,
      expectedAllowedAmount: true,
      underpaymentFlag: true,
    },
  });

  const paymentSums = await prisma.paymentRecord.groupBy({
    by: ["reimbursementCaseId"],
    where: { reimbursementCaseId: { in: cases.map((c) => c.id) } },
    _sum: { paidAmount: true },
  });
  const sumMap = new Map(paymentSums.map((row) => [row.reimbursementCaseId, decimalToNumber(row._sum.paidAmount)]));

  let totalExpected = 0;
  let totalPaid = 0;
  let totalVariance = 0;
  let underpaidCaseCount = 0;

  for (const reimbursementCase of cases) {
    const metrics = calculateCaseVariance({
      expectedAmount: decimalToNumber(reimbursementCase.expectedAmount),
      expectedAllowedAmount: decimalToNumber(reimbursementCase.expectedAllowedAmount),
      totalPaid: sumMap.get(reimbursementCase.id) ?? 0,
    });
    totalExpected += metrics.expectedAmount;
    totalPaid += metrics.totalPaid;
    totalVariance += metrics.varianceAmount;
    if (reimbursementCase.underpaymentFlag || metrics.underpaymentFlag) underpaidCaseCount += 1;
  }

  const result = {
    totalCases: cases.length,
    totalExpected,
    totalPaid,
    totalVariance,
    underpaidCaseCount,
    averagePaymentVariance: cases.length > 0 ? totalVariance / cases.length : 0,
    underpaymentRate: cases.length > 0 ? (underpaidCaseCount / cases.length) * 100 : 0,
  };

  logger.info("Reimbursement network analytics queried", {
    actorUserId: ctx.actorUserId,
    clinicId: input?.clinicId,
    totalCases: result.totalCases,
  });
  return result;
}

export async function getClinicReimbursementSummary(
  ctx: ServiceContext,
  input?: { clinicId?: string },
) {
  const rows = await calculateClinicVariance(ctx, input);
  logger.info("Reimbursement clinic analytics queried", {
    actorUserId: ctx.actorUserId,
    clinicId: input?.clinicId,
    rowCount: rows.length,
  });
  return rows;
}

export async function getPayerPerformanceSummary(
  ctx: ServiceContext,
  input?: { clinicId?: string; limit?: number },
) {
  const rows = await calculatePayerVariance(ctx, { clinicId: input?.clinicId });
  const sorted = rows.sort((a, b) => b.totalClaims - a.totalClaims).slice(0, input?.limit ?? 100);
  logger.info("Reimbursement payer analytics queried", {
    actorUserId: ctx.actorUserId,
    clinicId: input?.clinicId,
    rowCount: sorted.length,
  });
  return sorted;
}

export async function listUnderpaidCases(
  ctx: ServiceContext,
  input?: { clinicId?: string; limit?: number },
) {
  const scope = await resolveAnalyticsScope(ctx, input?.clinicId);
  const cases = await prisma.reimbursementCase.findMany({
    where: {
      clinicId: input?.clinicId ?? (scope.hasGlobal ? undefined : { in: scope.clinicIds }),
      underpaymentFlag: true,
    },
    include: {
      clinic: { select: { id: true, name: true } },
      claims: {
        select: { id: true, claimNumber: true, externalClaimId: true, status: true, submittedAt: true },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
      },
      payments: {
        select: { id: true, paidAmount: true, paidDate: true, sourceType: true },
        orderBy: [{ paidDate: "desc" }],
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: input?.limit ?? 100,
  });

  return cases.map((reimbursementCase) => {
    const totalPaid = reimbursementCase.payments.reduce(
      (acc, payment) => acc + decimalToNumber(payment.paidAmount),
      0,
    );
    const variance = calculateCaseVariance({
      expectedAmount: decimalToNumber(reimbursementCase.expectedAmount),
      expectedAllowedAmount: decimalToNumber(reimbursementCase.expectedAllowedAmount),
      totalPaid,
    });

    return {
      id: reimbursementCase.id,
      clinic: reimbursementCase.clinic,
      payerName: reimbursementCase.payerName,
      status: reimbursementCase.status,
      expectedAmount: variance.expectedAmount,
      expectedAllowedAmount: variance.expectedAllowedAmount,
      totalPaid: variance.totalPaid,
      varianceAmount: variance.varianceAmount,
      variancePercentage: variance.variancePercentage,
      underpaymentFlag: variance.underpaymentFlag,
      latestClaim: reimbursementCase.claims[0] ?? null,
      paymentCount: reimbursementCase.payments.length,
      updatedAt: reimbursementCase.updatedAt,
    };
  });
}

export async function createPayerAnalyticsSnapshots(
  ctx: ServiceContext,
  input: { organizationId: string; clinicId?: string },
) {
  await requirePermission(ctx.actorUserId, Permissions.analytics.manage, {
    scope: "ORGANIZATION",
    organizationId: input.organizationId,
  });

  const rows = await getPayerPerformanceSummary(ctx, { clinicId: input.clinicId });
  const created = await prisma.$transaction(
    rows.map((row) =>
      prisma.payerAnalyticsSnapshot.create({
        data: {
          organizationId: input.organizationId,
          payerName: row.payerName,
          totalClaims: row.totalClaims,
          totalExpected: row.totalExpected,
          totalPaid: row.totalPaid,
          totalVariance: row.totalVariance,
          underpaymentRate: row.underpaymentRate,
        },
      }),
    ),
  );

  await writeAuditLog({
    ctx: { ...ctx, organizationId: input.organizationId, clinicId: input.clinicId },
    action: "CREATE",
    entityType: "PayerAnalyticsSnapshotBatch",
    entityId: `${created.length}`,
    organizationId: input.organizationId,
    clinicId: input.clinicId,
    metadata: { count: created.length },
  });

  return created.length;
}
