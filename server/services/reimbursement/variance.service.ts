import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import type { ServiceContext } from "@/server/services/service-context";

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) return 0;
  return Number(value.toString());
}

export function calculateCaseVariance(input: {
  expectedAmount: number;
  expectedAllowedAmount?: number | null;
  totalPaid: number;
}) {
  const expectedAmount = input.expectedAmount;
  const paid = input.totalPaid;
  const varianceAmount = paid - expectedAmount;
  const variancePercentage = expectedAmount > 0 ? (varianceAmount / expectedAmount) * 100 : 0;
  const underpaymentBaseline = input.expectedAllowedAmount ?? expectedAmount;
  const underpaymentFlag = paid < underpaymentBaseline;

  return {
    expectedAmount,
    expectedAllowedAmount: input.expectedAllowedAmount ?? null,
    totalPaid: paid,
    varianceAmount,
    variancePercentage,
    underpaymentBaseline,
    underpaymentFlag,
  };
}

async function ensureAnalyticsReadAccess(ctx: ServiceContext, clinicId?: string) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const hasGlobal = access.globalRoleKeys.length > 0;

  if (clinicId) {
    await requirePermission(ctx.actorUserId, Permissions.analytics.read, { scope: "CLINIC", clinicId });
    return { hasGlobal, access, clinicIds: [clinicId] };
  }

  if (hasGlobal) {
    await requirePermission(ctx.actorUserId, Permissions.analytics.read, { scope: "GLOBAL" });
    return { hasGlobal, access, clinicIds: [] as string[] };
  }

  const firstClinicId = access.accessibleClinicIds[0];
  if (!firstClinicId) throw new AppError("No clinic access", "UNAUTHORIZED", 403);
  await requirePermission(ctx.actorUserId, Permissions.analytics.read, {
    scope: "CLINIC",
    clinicId: firstClinicId,
  });
  return { hasGlobal, access, clinicIds: access.accessibleClinicIds };
}

export async function calculateClinicVariance(
  ctx: ServiceContext,
  input?: { clinicId?: string },
) {
  const scope = await ensureAnalyticsReadAccess(ctx, input?.clinicId);

  const cases = await prisma.reimbursementCase.findMany({
    where: {
      clinicId: input?.clinicId ?? (scope.hasGlobal ? undefined : { in: scope.clinicIds }),
    },
    select: {
      id: true,
      clinicId: true,
      expectedAmount: true,
      expectedAllowedAmount: true,
      underpaymentFlag: true,
      clinic: { select: { id: true, name: true } },
    },
  });

  const paymentSums = await prisma.paymentRecord.groupBy({
    by: ["reimbursementCaseId"],
    where: { reimbursementCaseId: { in: cases.map((c) => c.id) } },
    _sum: { paidAmount: true },
  });
  const sumMap = new Map(paymentSums.map((row) => [row.reimbursementCaseId, decimalToNumber(row._sum.paidAmount)]));

  const byClinic = new Map<
    string,
    {
      clinicId: string;
      clinicName: string;
      totalCases: number;
      totalExpected: number;
      totalPaid: number;
      totalVariance: number;
      underpaidCaseCount: number;
      averageVariance: number;
    }
  >();

  for (const reimbursementCase of cases) {
    const paid = sumMap.get(reimbursementCase.id) ?? 0;
    const variance = calculateCaseVariance({
      expectedAmount: decimalToNumber(reimbursementCase.expectedAmount),
      expectedAllowedAmount: decimalToNumber(reimbursementCase.expectedAllowedAmount),
      totalPaid: paid,
    });

    const key = reimbursementCase.clinicId;
    const existing = byClinic.get(key) ?? {
      clinicId: reimbursementCase.clinic.id,
      clinicName: reimbursementCase.clinic.name,
      totalCases: 0,
      totalExpected: 0,
      totalPaid: 0,
      totalVariance: 0,
      underpaidCaseCount: 0,
      averageVariance: 0,
    };

    existing.totalCases += 1;
    existing.totalExpected += variance.expectedAmount;
    existing.totalPaid += variance.totalPaid;
    existing.totalVariance += variance.varianceAmount;
    if (reimbursementCase.underpaymentFlag || variance.underpaymentFlag) existing.underpaidCaseCount += 1;
    byClinic.set(key, existing);
  }

  return Array.from(byClinic.values()).map((row) => ({
    ...row,
    averageVariance: row.totalCases > 0 ? row.totalVariance / row.totalCases : 0,
  }));
}

export async function calculatePayerVariance(
  ctx: ServiceContext,
  input?: { clinicId?: string },
) {
  const scope = await ensureAnalyticsReadAccess(ctx, input?.clinicId);

  const cases = await prisma.reimbursementCase.findMany({
    where: {
      clinicId: input?.clinicId ?? (scope.hasGlobal ? undefined : { in: scope.clinicIds }),
    },
    select: {
      id: true,
      payerName: true,
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

  const byPayer = new Map<
    string,
    {
      payerName: string;
      totalClaims: number;
      totalExpected: number;
      totalPaid: number;
      totalVariance: number;
      underpaidCaseCount: number;
      underpaymentRate: number;
      averageVariance: number;
    }
  >();

  for (const reimbursementCase of cases) {
    const paid = sumMap.get(reimbursementCase.id) ?? 0;
    const variance = calculateCaseVariance({
      expectedAmount: decimalToNumber(reimbursementCase.expectedAmount),
      expectedAllowedAmount: decimalToNumber(reimbursementCase.expectedAllowedAmount),
      totalPaid: paid,
    });

    const key = reimbursementCase.payerName;
    const existing = byPayer.get(key) ?? {
      payerName: key,
      totalClaims: 0,
      totalExpected: 0,
      totalPaid: 0,
      totalVariance: 0,
      underpaidCaseCount: 0,
      underpaymentRate: 0,
      averageVariance: 0,
    };

    existing.totalClaims += 1;
    existing.totalExpected += variance.expectedAmount;
    existing.totalPaid += variance.totalPaid;
    existing.totalVariance += variance.varianceAmount;
    if (reimbursementCase.underpaymentFlag || variance.underpaymentFlag) existing.underpaidCaseCount += 1;
    byPayer.set(key, existing);
  }

  return Array.from(byPayer.values()).map((row) => ({
    ...row,
    underpaymentRate: row.totalClaims > 0 ? (row.underpaidCaseCount / row.totalClaims) * 100 : 0,
    averageVariance: row.totalClaims > 0 ? row.totalVariance / row.totalClaims : 0,
  }));
}
