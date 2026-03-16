import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import type { ServiceContext } from "@/server/services/service-context";
import { getExpectedReimbursementGuidance } from "@/server/services/payer-rules/payer-rule.service";
import { dispatchRevenueSignalsToAutomation } from "@/server/services/automation/automation-engine.service";

type SignalSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type SignalType = "APPEAL_OPPORTUNITY" | "HIGH_VARIANCE_RISK" | "PAYER_PATTERN_ALERT" | "FORECAST_RISK";

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) return 0;
  return Number(value.toString());
}

async function resolveRevenueScope(ctx: ServiceContext, organizationId?: string, clinicId?: string) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const orgId = organizationId ?? access.defaultOrganizationId ?? undefined;
  if (!orgId) throw new AppError("No organization access", "UNAUTHORIZED", 403);

  await requirePermission(ctx.actorUserId, Permissions.revenue.read, {
    scope: "ORGANIZATION",
    organizationId: orgId,
  });

  const clinics = await prisma.clinic.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  });
  let clinicIds = clinics.map((c) => c.id);
  if (access.globalRoleKeys.length === 0) {
    clinicIds = clinicIds.filter((id) => access.accessibleClinicIds.includes(id));
  }
  if (clinicId) clinicIds = clinicIds.filter((id) => id === clinicId);
  if (clinicIds.length === 0) throw new AppError("No clinic access in organization", "UNAUTHORIZED", 403);
  return { organizationId: orgId, clinicIds, clinics };
}

function signalSeverityFromVariance(input: { varianceAmount: number; variancePct: number }): SignalSeverity {
  const abs = Math.abs(input.varianceAmount);
  const pct = Math.abs(input.variancePct);
  if (abs >= 7500 || pct >= 50) return "CRITICAL";
  if (abs >= 3500 || pct >= 30) return "HIGH";
  if (abs >= 1200 || pct >= 15) return "MEDIUM";
  return "LOW";
}

export async function identifyUnderpaymentOpportunities(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; limit?: number },
) {
  const scope = await resolveRevenueScope(ctx, input.organizationId, input.clinicId);
  const cases = await prisma.reimbursementCase.findMany({
    where: {
      organizationId: scope.organizationId,
      clinicId: { in: scope.clinicIds },
      underpaymentFlag: true,
    },
    include: {
      clinic: { select: { id: true, name: true } },
      claims: {
        select: { id: true, status: true, claimNumber: true, externalClaimId: true },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: input.limit ?? 100,
  });
  const sums = await prisma.paymentRecord.groupBy({
    by: ["reimbursementCaseId"],
    where: { reimbursementCaseId: { in: cases.map((c) => c.id) } },
    _sum: { paidAmount: true },
  });
  const paidMap = new Map(sums.map((row) => [row.reimbursementCaseId, decimalToNumber(row._sum.paidAmount)]));

  const opportunities = cases.map((c) => {
    const expected = decimalToNumber(c.expectedAmount);
    const paid = paidMap.get(c.id) ?? 0;
    const varianceAmount = paid - expected;
    const variancePct = expected > 0 ? (varianceAmount / expected) * 100 : 0;
    const severity = signalSeverityFromVariance({ varianceAmount, variancePct });
    return {
      reimbursementCaseId: c.id,
      clinic: c.clinic,
      payerName: c.payerName,
      expectedAmount: expected,
      paidAmount: paid,
      varianceAmount,
      variancePct,
      severity,
      latestClaim: c.claims[0] ?? null,
      suggestedAction:
        severity === "CRITICAL" || severity === "HIGH"
          ? "Create appeal review task and payer variance escalation"
          : "Review payment variance and verify remittance details",
    };
  });

  logger.info("Revenue underpayment opportunities generated", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    count: opportunities.length,
  });
  return opportunities;
}

export async function identifyAppealCandidates(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; limit?: number },
) {
  const scope = await resolveRevenueScope(ctx, input.organizationId, input.clinicId);
  const claims = await prisma.claimRecord.findMany({
    where: {
      organizationId: scope.organizationId,
      clinicId: { in: scope.clinicIds },
      status: { in: ["DENIED", "REJECTED"] },
    },
    include: {
      reimbursementCase: {
        select: {
          id: true,
          payerName: true,
          expectedAmount: true,
          clinic: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: input.limit ?? 100,
  });

  const candidates = claims.map((c) => {
    const expected = decimalToNumber(c.reimbursementCase.expectedAmount);
    const billed = decimalToNumber(c.billedAmount);
    const valueAtRisk = Math.max(expected, billed);
    const severity: SignalSeverity =
      valueAtRisk >= 5000 ? "CRITICAL" : valueAtRisk >= 2500 ? "HIGH" : valueAtRisk >= 1000 ? "MEDIUM" : "LOW";
    return {
      claimId: c.id,
      reimbursementCaseId: c.reimbursementCaseId,
      clinic: c.reimbursementCase.clinic,
      payerName: c.payerName,
      claimStatus: c.status,
      valueAtRisk,
      severity,
      suggestedAction:
        c.status === "DENIED"
          ? "Initiate appeal package assembly and payer rule review"
          : "Correct rejection reason and resubmit claim",
    };
  });

  logger.info("Revenue appeal candidates generated", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    count: candidates.length,
  });
  return candidates;
}

export async function identifyPayerVariancePatterns(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; limit?: number },
) {
  const scope = await resolveRevenueScope(ctx, input.organizationId, input.clinicId);
  const cases = await prisma.reimbursementCase.findMany({
    where: { organizationId: scope.organizationId, clinicId: { in: scope.clinicIds } },
    select: {
      id: true,
      payerName: true,
      expectedAmount: true,
      underpaymentFlag: true,
    },
  });
  const sums = await prisma.paymentRecord.groupBy({
    by: ["reimbursementCaseId"],
    where: { reimbursementCaseId: { in: cases.map((c) => c.id) } },
    _sum: { paidAmount: true },
  });
  const paidMap = new Map(sums.map((row) => [row.reimbursementCaseId, decimalToNumber(row._sum.paidAmount)]));
  const map = new Map<
    string,
    { payerName: string; caseCount: number; totalExpected: number; totalPaid: number; underpaid: number }
  >();

  for (const c of cases) {
    const row = map.get(c.payerName) ?? {
      payerName: c.payerName,
      caseCount: 0,
      totalExpected: 0,
      totalPaid: 0,
      underpaid: 0,
    };
    row.caseCount += 1;
    row.totalExpected += decimalToNumber(c.expectedAmount);
    row.totalPaid += paidMap.get(c.id) ?? 0;
    if (c.underpaymentFlag) row.underpaid += 1;
    map.set(c.payerName, row);
  }

  const patterns = Array.from(map.values())
    .map((row) => {
      const variance = row.totalPaid - row.totalExpected;
      const variancePct = row.totalExpected > 0 ? (variance / row.totalExpected) * 100 : 0;
      const underpaymentRate = row.caseCount > 0 ? (row.underpaid / row.caseCount) * 100 : 0;
      const severity = signalSeverityFromVariance({ varianceAmount: variance, variancePct });
      return {
        payerName: row.payerName,
        caseCount: row.caseCount,
        totalExpected: row.totalExpected,
        totalPaid: row.totalPaid,
        variance,
        variancePct,
        underpaymentRate,
        severity,
        suggestedAction:
          severity === "CRITICAL" || severity === "HIGH"
            ? "Review payer contract assumptions and update payer rules"
            : "Monitor payer variance trend",
      };
    })
    .sort((a, b) => a.variance - b.variance)
    .slice(0, input.limit ?? 50);

  logger.info("Revenue payer variance patterns generated", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    count: patterns.length,
  });
  return patterns;
}

export async function forecastExpectedReimbursement(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; payerName?: string; limit?: number },
) {
  const scope = await resolveRevenueScope(ctx, input.organizationId, input.clinicId);
  const openCases = await prisma.reimbursementCase.findMany({
    where: {
      organizationId: scope.organizationId,
      clinicId: { in: scope.clinicIds },
      payerName: input.payerName
        ? { equals: input.payerName, mode: "insensitive" }
        : undefined,
      status: { in: ["EXPECTED", "CLAIM_DRAFT", "SUBMITTED", "PENDING_PAYMENT", "PARTIALLY_PAID"] },
    },
    include: {
      clinic: { select: { id: true, name: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: input.limit ?? 100,
  });

  const historical = await prisma.reimbursementCase.findMany({
    where: {
      organizationId: scope.organizationId,
      clinicId: { in: scope.clinicIds },
      payerName: input.payerName
        ? { equals: input.payerName, mode: "insensitive" }
        : undefined,
      status: { in: ["PAID", "CLOSED", "PARTIALLY_PAID", "DENIED"] },
    },
    select: { id: true, payerName: true, clinicId: true, expectedAmount: true },
    take: 500,
  });
  const histSums = await prisma.paymentRecord.groupBy({
    by: ["reimbursementCaseId"],
    where: { reimbursementCaseId: { in: historical.map((h) => h.id) } },
    _sum: { paidAmount: true },
  });
  const histPaidByCase = new Map(histSums.map((row) => [row.reimbursementCaseId, decimalToNumber(row._sum.paidAmount)]));

  const payerRatios = new Map<string, number[]>();
  for (const row of historical) {
    const expected = decimalToNumber(row.expectedAmount);
    const paid = histPaidByCase.get(row.id) ?? 0;
    const ratio = expected > 0 ? paid / expected : 0;
    const list = payerRatios.get(row.payerName) ?? [];
    list.push(Math.max(0, Math.min(2, ratio)));
    payerRatios.set(row.payerName, list);
  }
  const payerAvgRatio = new Map(
    Array.from(payerRatios.entries()).map(([payerName, ratios]) => [
      payerName,
      ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0.85,
    ]),
  );

  const forecasts = [];
  for (const c of openCases) {
    const expected = decimalToNumber(c.expectedAmount);
    const historicalRatio = payerAvgRatio.get(c.payerName) ?? 0.85;
    let guidance: Awaited<ReturnType<typeof getExpectedReimbursementGuidance>> = {
      matched: false,
      recommendation: null,
      sourceRuleId: null,
      evidenceCount: 0,
    };
    try {
      guidance = await getExpectedReimbursementGuidance(
        { actorUserId: ctx.actorUserId },
        {
          organizationId: scope.organizationId,
          clinicId: c.clinicId,
          payerName: c.payerName,
          serviceContext: "reimbursement",
        },
      );
    } catch {
      // Revenue forecasting should still work when payer-rule permissions are unavailable.
      guidance = {
        matched: false,
        recommendation: null,
        sourceRuleId: null,
        evidenceCount: 0,
      };
    }
    const guidedAmount =
      guidance.matched && guidance.recommendation?.expectedAmount !== null && guidance.recommendation?.expectedAmount !== undefined
        ? guidance.recommendation.expectedAmount
        : null;
    const forecastAmount = guidedAmount ?? expected * historicalRatio;
    const forecastRisk = expected > 0 ? ((forecastAmount - expected) / expected) * 100 : 0;
    const severity: SignalSeverity = forecastRisk <= -30 ? "HIGH" : forecastRisk <= -15 ? "MEDIUM" : "LOW";
    forecasts.push({
      reimbursementCaseId: c.id,
      clinic: c.clinic,
      payerName: c.payerName,
      expectedAmount: expected,
      forecastAmount,
      forecastRiskPct: forecastRisk,
      confidence: guidance.recommendation?.confidenceLevel ?? "MEDIUM",
      severity,
      methodology: guidedAmount ? "payer_rule_guided" : "historical_ratio",
    });
  }

  logger.info("Revenue forecast generated", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    caseCount: forecasts.length,
  });
  return forecasts;
}

export async function generateRevenueOptimizationSignals(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; automation?: boolean },
) {
  const scope = await resolveRevenueScope(ctx, input.organizationId, input.clinicId);
  await requirePermission(ctx.actorUserId, Permissions.revenue.manage, {
    scope: "ORGANIZATION",
    organizationId: scope.organizationId,
  });

  const [underpayment, appeals, payerPatterns, forecasts] = await Promise.all([
    identifyUnderpaymentOpportunities(ctx, { organizationId: scope.organizationId, clinicId: input.clinicId, limit: 100 }),
    identifyAppealCandidates(ctx, { organizationId: scope.organizationId, clinicId: input.clinicId, limit: 100 }),
    identifyPayerVariancePatterns(ctx, { organizationId: scope.organizationId, clinicId: input.clinicId, limit: 50 }),
    forecastExpectedReimbursement(ctx, { organizationId: scope.organizationId, clinicId: input.clinicId, limit: 100 }),
  ]);

  const candidates: Array<{
    organizationId: string;
    clinicId?: string | null;
    payerName?: string | null;
    reimbursementCaseId?: string | null;
    signalType: SignalType;
    signalSeverity: SignalSeverity;
    recommendedAction: string;
    explanation: string;
  }> = [];

  for (const row of underpayment) {
    if (row.severity === "LOW") continue;
    candidates.push({
      organizationId: scope.organizationId,
      clinicId: row.clinic.id,
      payerName: row.payerName,
      reimbursementCaseId: row.reimbursementCaseId,
      signalType: "HIGH_VARIANCE_RISK",
      signalSeverity: row.severity,
      recommendedAction: row.suggestedAction,
      explanation: `Variance ${row.varianceAmount.toFixed(2)} (${row.variancePct.toFixed(1)}%) for payer ${row.payerName}.`,
    });
  }

  for (const row of appeals) {
    if (row.severity === "LOW") continue;
    candidates.push({
      organizationId: scope.organizationId,
      clinicId: row.clinic.id,
      payerName: row.payerName,
      reimbursementCaseId: row.reimbursementCaseId,
      signalType: "APPEAL_OPPORTUNITY",
      signalSeverity: row.severity,
      recommendedAction: row.suggestedAction,
      explanation: `Claim ${row.claimStatus} with value at risk ${row.valueAtRisk.toFixed(2)}.`,
    });
  }

  for (const row of payerPatterns) {
    if (row.severity === "LOW") continue;
    candidates.push({
      organizationId: scope.organizationId,
      clinicId: null,
      payerName: row.payerName,
      reimbursementCaseId: null,
      signalType: "PAYER_PATTERN_ALERT",
      signalSeverity: row.severity,
      recommendedAction: row.suggestedAction,
      explanation: `Payer variance ${row.variance.toFixed(2)} across ${row.caseCount} cases.`,
    });
  }

  for (const row of forecasts) {
    if (row.severity === "LOW") continue;
    candidates.push({
      organizationId: scope.organizationId,
      clinicId: row.clinic.id,
      payerName: row.payerName,
      reimbursementCaseId: row.reimbursementCaseId,
      signalType: "FORECAST_RISK",
      signalSeverity: row.severity,
      recommendedAction: "Review projected reimbursement gap and update payer strategy.",
      explanation: `Forecast risk ${row.forecastRiskPct.toFixed(1)}% vs expected amount.`,
    });
  }

  const createdSignals = [];
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  for (const signal of candidates) {
    const existing = await prisma.revenueOptimizationSignal.findFirst({
      where: {
        organizationId: signal.organizationId,
        clinicId: signal.clinicId ?? null,
        payerName: signal.payerName ?? null,
        reimbursementCaseId: signal.reimbursementCaseId ?? null,
        signalType: signal.signalType,
        createdAt: { gte: cutoff },
      },
      select: { id: true },
    });
    if (existing) continue;
    const created = await prisma.revenueOptimizationSignal.create({
      data: {
        organizationId: signal.organizationId,
        clinicId: signal.clinicId ?? null,
        payerName: signal.payerName ?? null,
        reimbursementCaseId: signal.reimbursementCaseId ?? null,
        signalType: signal.signalType,
        signalSeverity: signal.signalSeverity,
        recommendedAction: signal.recommendedAction,
        explanation: signal.explanation,
      },
    });
    createdSignals.push(created);
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: scope.organizationId },
    action: "CREATE",
    entityType: "RevenueOptimizationSignalBatch",
    entityId: `${createdSignals.length}`,
    organizationId: scope.organizationId,
    clinicId: input.clinicId ?? null,
    metadata: { generated: createdSignals.length },
  });

  if (input.automation !== false && createdSignals.length > 0) {
    await dispatchRevenueSignalsToAutomation(
      { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: input.clinicId },
      {
        organizationId: scope.organizationId,
        signals: createdSignals.map((s) => ({
          id: s.id,
          clinicId: s.clinicId,
          reimbursementCaseId: s.reimbursementCaseId,
          signalType: s.signalType,
          signalSeverity: s.signalSeverity,
          explanation: s.explanation,
          recommendedAction: s.recommendedAction,
        })),
      },
    );
  }

  logger.info("Revenue optimization signals generated", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    generated: createdSignals.length,
  });
  return createdSignals;
}

export async function listRevenueOptimizationSignals(
  ctx: ServiceContext,
  input: {
    organizationId?: string;
    clinicId?: string;
    signalType?: SignalType;
    signalSeverity?: SignalSeverity;
    limit?: number;
  },
) {
  const scope = await resolveRevenueScope(ctx, input.organizationId, input.clinicId);

  return prisma.revenueOptimizationSignal.findMany({
    where: {
      organizationId: scope.organizationId,
      clinicId: input.clinicId ?? undefined,
      signalType: input.signalType,
      signalSeverity: input.signalSeverity,
    },
    include: {
      clinic: { select: { id: true, name: true } },
      reimbursementCase: { select: { id: true, status: true, payerName: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: input.limit ?? 100,
  });
}

export async function getRevenueOpportunities(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; limit?: number },
) {
  const [underpayment, appeals, payerPatterns] = await Promise.all([
    identifyUnderpaymentOpportunities(ctx, input),
    identifyAppealCandidates(ctx, input),
    identifyPayerVariancePatterns(ctx, input),
  ]);

  return {
    underpaymentOpportunities: underpayment.slice(0, input.limit ?? 50),
    appealCandidates: appeals.slice(0, input.limit ?? 50),
    payerVariancePatterns: payerPatterns.slice(0, input.limit ?? 50),
  };
}
