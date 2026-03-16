import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import type { ServiceContext } from "@/server/services/service-context";

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) return 0;
  return Number(value.toString());
}

function daysBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function resolveOrganizationScope(ctx: ServiceContext, organizationId?: string) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const targetOrgId = organizationId ?? access.defaultOrganizationId ?? undefined;
  if (!targetOrgId) throw new AppError("No organization access", "UNAUTHORIZED", 403);

  await requirePermission(ctx.actorUserId, Permissions.benchmarking.read, {
    scope: "ORGANIZATION",
    organizationId: targetOrgId,
  });

  const hasGlobal = access.globalRoleKeys.length > 0;
  const orgClinics = await prisma.clinic.findMany({
    where: { organizationId: targetOrgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const clinicIds = hasGlobal
    ? orgClinics.map((c) => c.id)
    : orgClinics.filter((c) => access.accessibleClinicIds.includes(c.id)).map((c) => c.id);

  if (clinicIds.length === 0) throw new AppError("No clinic access in organization", "UNAUTHORIZED", 403);
  return { organizationId: targetOrgId, clinicIds, clinics: orgClinics.filter((c) => clinicIds.includes(c.id)) };
}

async function loadBenchmarkInputs(ctx: ServiceContext, organizationId?: string) {
  const scope = await resolveOrganizationScope(ctx, organizationId);

  const reimbursementCases = await prisma.reimbursementCase.findMany({
    where: { organizationId: scope.organizationId, clinicId: { in: scope.clinicIds } },
    select: {
      id: true,
      clinicId: true,
      payerName: true,
      expectedAmount: true,
      expectedAllowedAmount: true,
      underpaymentFlag: true,
      createdAt: true,
    },
  });

  const payments = await prisma.paymentRecord.findMany({
    where: {
      organizationId: scope.organizationId,
      clinicId: { in: scope.clinicIds },
      reimbursementCaseId: { in: reimbursementCases.map((c) => c.id) },
    },
    select: { reimbursementCaseId: true, clinicId: true, paidAmount: true, paidDate: true, sourceType: true },
  });

  const paCases = await prisma.priorAuthorizationCase.findMany({
    where: { organizationId: scope.organizationId, clinicId: { in: scope.clinicIds } },
    select: { id: true, clinicId: true, payerName: true, status: true },
  });

  const claims = await prisma.claimRecord.findMany({
    where: { organizationId: scope.organizationId, clinicId: { in: scope.clinicIds } },
    select: { id: true, clinicId: true, payerName: true, status: true, submittedAt: true, reimbursementCaseId: true },
  });

  const remittancePayments = await prisma.remittancePayment.findMany({
    where: {
      remittanceFile: {
        organizationId: scope.organizationId,
        clinicId: { in: scope.clinicIds },
      },
    },
    select: {
      id: true,
      paidAmount: true,
      adjustmentAmount: true,
      matchedReimbursementCaseId: true,
      reconciliationStatus: true,
      remittanceFile: { select: { clinicId: true, payerName: true, paymentDate: true } },
    },
  });

  return { ...scope, reimbursementCases, payments, paCases, claims, remittancePayments };
}

export async function getClinicBenchmarkSummary(ctx: ServiceContext, input?: { organizationId?: string }) {
  const data = await loadBenchmarkInputs(ctx, input?.organizationId);
  const byCasePaymentTotal = new Map<string, number>();
  const byCaseFirstPayment = new Map<string, Date>();

  for (const payment of data.payments) {
    byCasePaymentTotal.set(
      payment.reimbursementCaseId,
      (byCasePaymentTotal.get(payment.reimbursementCaseId) ?? 0) + decimalToNumber(payment.paidAmount),
    );
    const existing = byCaseFirstPayment.get(payment.reimbursementCaseId);
    if (!existing || payment.paidDate < existing) byCaseFirstPayment.set(payment.reimbursementCaseId, payment.paidDate);
  }

  const rows = data.clinics.map((clinic) => {
    const cases = data.reimbursementCases.filter((c) => c.clinicId === clinic.id);
    const pa = data.paCases.filter((p) => p.clinicId === clinic.id);
    const paidTotal = cases.reduce((acc, c) => acc + (byCasePaymentTotal.get(c.id) ?? 0), 0);
    const timelines = cases
      .map((c) => {
        const firstPayment = byCaseFirstPayment.get(c.id);
        if (!firstPayment) return null;
        return daysBetween(c.createdAt, firstPayment);
      })
      .filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0);
    const underpaid = cases.filter((c) => c.underpaymentFlag).length;
    const paDecided = pa.filter((p) => p.status === "APPROVED" || p.status === "DENIED");
    const paApproved = pa.filter((p) => p.status === "APPROVED").length;
    const payerCounts = new Map<string, number>();
    for (const c of cases) payerCounts.set(c.payerName, (payerCounts.get(c.payerName) ?? 0) + 1);
    const totalPayerCount = Array.from(payerCounts.values()).reduce((a, b) => a + b, 0);
    const payerMix = Array.from(payerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([payerName, count]) => ({
        payerName,
        count,
        percentage: totalPayerCount > 0 ? (count / totalPayerCount) * 100 : 0,
      }));

    return {
      clinicId: clinic.id,
      clinicName: clinic.name,
      treatmentCount: cases.length,
      totalPaid: paidTotal,
      avgReimbursementPerTreatment: cases.length > 0 ? paidTotal / cases.length : 0,
      avgDaysToPayment: average(timelines),
      underpaymentRate: cases.length > 0 ? (underpaid / cases.length) * 100 : 0,
      paApprovalRate: paDecided.length > 0 ? (paApproved / paDecided.length) * 100 : 0,
      payerMix,
    };
  });

  logger.info("Network clinic benchmark queried", {
    actorUserId: ctx.actorUserId,
    organizationId: data.organizationId,
    clinicCount: rows.length,
  });
  return rows;
}

export async function getPayerBenchmarkSummary(ctx: ServiceContext, input?: { organizationId?: string; limit?: number }) {
  const data = await loadBenchmarkInputs(ctx, input?.organizationId);

  const byCasePaymentTotal = new Map<string, number>();
  const byCaseFirstPayment = new Map<string, Date>();
  for (const payment of data.payments) {
    byCasePaymentTotal.set(
      payment.reimbursementCaseId,
      (byCasePaymentTotal.get(payment.reimbursementCaseId) ?? 0) + decimalToNumber(payment.paidAmount),
    );
    const existing = byCaseFirstPayment.get(payment.reimbursementCaseId);
    if (!existing || payment.paidDate < existing) byCaseFirstPayment.set(payment.reimbursementCaseId, payment.paidDate);
  }

  const payerMap = new Map<
    string,
    {
      payerName: string;
      caseCount: number;
      totalExpected: number;
      totalPaid: number;
      underpaidCount: number;
      paymentTimelines: number[];
      clinicIds: Set<string>;
    }
  >();

  for (const c of data.reimbursementCases) {
    const row = payerMap.get(c.payerName) ?? {
      payerName: c.payerName,
      caseCount: 0,
      totalExpected: 0,
      totalPaid: 0,
      underpaidCount: 0,
      paymentTimelines: [],
      clinicIds: new Set<string>(),
    };
    row.caseCount += 1;
    row.totalExpected += decimalToNumber(c.expectedAmount);
    row.totalPaid += byCasePaymentTotal.get(c.id) ?? 0;
    row.clinicIds.add(c.clinicId);
    if (c.underpaymentFlag) row.underpaidCount += 1;
    const firstPayment = byCaseFirstPayment.get(c.id);
    if (firstPayment) row.paymentTimelines.push(daysBetween(c.createdAt, firstPayment));
    payerMap.set(c.payerName, row);
  }

  const remittanceByPayer = new Map<string, number>();
  for (const rp of data.remittancePayments) {
    const payer = rp.remittanceFile.payerName ?? "UNKNOWN";
    remittanceByPayer.set(payer, (remittanceByPayer.get(payer) ?? 0) + decimalToNumber(rp.paidAmount));
  }

  const result = Array.from(payerMap.values())
    .map((row) => ({
      payerName: row.payerName,
      caseCount: row.caseCount,
      clinicCount: row.clinicIds.size,
      totalExpected: row.totalExpected,
      totalPaid: row.totalPaid,
      totalVariance: row.totalPaid - row.totalExpected,
      avgDaysToPayment: average(row.paymentTimelines),
      underpaymentRate: row.caseCount > 0 ? (row.underpaidCount / row.caseCount) * 100 : 0,
      remittancePaidAmount: remittanceByPayer.get(row.payerName) ?? 0,
    }))
    .sort((a, b) => b.caseCount - a.caseCount)
    .slice(0, input?.limit ?? 100);

  logger.info("Network payer benchmark queried", {
    actorUserId: ctx.actorUserId,
    organizationId: data.organizationId,
    payerCount: result.length,
  });
  return result;
}

export async function getAuthorizationBenchmarkSummary(
  ctx: ServiceContext,
  input?: { organizationId?: string },
) {
  const data = await loadBenchmarkInputs(ctx, input?.organizationId);

  const clinicRows = data.clinics.map((clinic) => {
    const pa = data.paCases.filter((p) => p.clinicId === clinic.id);
    const approved = pa.filter((p) => p.status === "APPROVED").length;
    const denied = pa.filter((p) => p.status === "DENIED").length;
    const pending = pa.filter((p) =>
      ["DRAFT", "SUBMITTED", "PENDING_PAYER"].includes(p.status),
    ).length;
    const decided = approved + denied;
    return {
      clinicId: clinic.id,
      clinicName: clinic.name,
      totalPA: pa.length,
      approved,
      denied,
      pending,
      approvalRate: decided > 0 ? (approved / decided) * 100 : 0,
    };
  });

  const payerMap = new Map<string, { payerName: string; total: number; approved: number; denied: number }>();
  for (const pa of data.paCases) {
    const row = payerMap.get(pa.payerName) ?? { payerName: pa.payerName, total: 0, approved: 0, denied: 0 };
    row.total += 1;
    if (pa.status === "APPROVED") row.approved += 1;
    if (pa.status === "DENIED") row.denied += 1;
    payerMap.set(pa.payerName, row);
  }
  const payerRows = Array.from(payerMap.values())
    .map((row) => ({
      ...row,
      approvalRate: row.approved + row.denied > 0 ? (row.approved / (row.approved + row.denied)) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);

  logger.info("Network authorization benchmark queried", {
    actorUserId: ctx.actorUserId,
    organizationId: data.organizationId,
    paCount: data.paCases.length,
  });
  return {
    organizationId: data.organizationId,
    totalPA: data.paCases.length,
    clinicRows,
    payerRows,
  };
}

export async function getPaymentTimelineBenchmark(
  ctx: ServiceContext,
  input?: { organizationId?: string },
) {
  const data = await loadBenchmarkInputs(ctx, input?.organizationId);
  const byCaseFirstPayment = new Map<string, Date>();
  for (const payment of data.payments) {
    const existing = byCaseFirstPayment.get(payment.reimbursementCaseId);
    if (!existing || payment.paidDate < existing) byCaseFirstPayment.set(payment.reimbursementCaseId, payment.paidDate);
  }

  const clinicRows = data.clinics.map((clinic) => {
    const timelines = data.reimbursementCases
      .filter((c) => c.clinicId === clinic.id)
      .map((c) => {
        const paidAt = byCaseFirstPayment.get(c.id);
        if (!paidAt) return null;
        return daysBetween(c.createdAt, paidAt);
      })
      .filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0);

    return {
      clinicId: clinic.id,
      clinicName: clinic.name,
      measuredCases: timelines.length,
      avgDaysToPayment: average(timelines),
      medianDaysToPayment: percentile(timelines, 50),
      p90DaysToPayment: percentile(timelines, 90),
      paidWithin30DaysRate:
        timelines.length > 0 ? (timelines.filter((d) => d <= 30).length / timelines.length) * 100 : 0,
    };
  });

  logger.info("Network payment timeline benchmark queried", {
    actorUserId: ctx.actorUserId,
    organizationId: data.organizationId,
    clinicCount: clinicRows.length,
  });
  return clinicRows;
}
