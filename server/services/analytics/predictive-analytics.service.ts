import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import type { ServiceContext } from "@/server/services/service-context";
import { getPaymentTimelineBenchmark } from "@/server/services/analytics/network-benchmark.service";
import { getPayerPerformanceSummary } from "@/server/services/analytics/reimbursement-analytics.service";
import { getClinicHealthSummary, getPAOpsSummary } from "@/server/services/analytics/command-center.service";
import { forecastExpectedReimbursement } from "@/server/services/analytics/revenue-optimization.service";
import { dispatchPredictiveSignalsToAutomation } from "@/server/services/automation/automation-engine.service";

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) return 0;
  return Number(value.toString());
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function movingAverage(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function resolvePredictiveScope(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const organizationId = input.organizationId ?? access.defaultOrganizationId ?? undefined;
  if (!organizationId) throw new AppError("No organization access", "UNAUTHORIZED", 403);
  await requirePermission(ctx.actorUserId, Permissions.analytics.read, {
    scope: "ORGANIZATION",
    organizationId,
  });
  return { organizationId, clinicId: input.clinicId };
}

export async function predictPaymentTimeline(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  const scope = await resolvePredictiveScope(ctx, input);
  const paymentTimelineRows = await getPaymentTimelineBenchmark(
    { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
    { organizationId: scope.organizationId },
  );

  const globalAvg = movingAverage(paymentTimelineRows.map((row) => row.avgDaysToPayment));
  const prediction = paymentTimelineRows.map((row) => {
    const baseline = row.avgDaysToPayment;
    const trendWeight = row.p90DaysToPayment > 0 ? row.p90DaysToPayment * 0.2 : 0;
    const predictedDays = baseline + trendWeight;
    const riskPct = globalAvg > 0 ? ((predictedDays - globalAvg) / globalAvg) * 100 : 0;
    const confidenceScore = clamp((row.measuredCases / 20) * 100, 35, 95);
    return {
      clinicId: row.clinicId,
      clinicName: row.clinicName,
      baselineDays: baseline,
      predictedDaysToPayment: Number(predictedDays.toFixed(1)),
      riskDeltaPct: Number(riskPct.toFixed(1)),
      confidenceScore: Number(confidenceScore.toFixed(1)),
      signalType: "PAYMENT_DELAY_RISK" as const,
      riskBand: riskPct > 25 ? "HIGH" : riskPct > 10 ? "MEDIUM" : "LOW",
      explanation: `${row.clinicName} predicts ${predictedDays.toFixed(1)} days to payment vs ${globalAvg.toFixed(1)} day network baseline.`,
    };
  });

  logger.info("Predictive payment timeline generated", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
    count: prediction.length,
  });
  return prediction;
}

export async function predictUnderpaymentRisk(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  const scope = await resolvePredictiveScope(ctx, input);
  const payerRows = await getPayerPerformanceSummary(
    { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
    { clinicId: scope.clinicId, limit: 30 },
  );

  const predictions = payerRows.map((row) => {
    const variancePct = row.totalExpected > 0 ? (row.totalVariance / row.totalExpected) * 100 : 0;
    const trendProjection = variancePct + row.underpaymentRate * -0.15;
    const confidenceScore = clamp((row.totalClaims / 25) * 100, 30, 95);
    return {
      payerName: row.payerName,
      totalClaims: row.totalClaims,
      currentUnderpaymentRate: row.underpaymentRate,
      predictedUnderpaymentRate: Number(clamp(row.underpaymentRate + Math.abs(trendProjection) * 0.25, 0, 100).toFixed(1)),
      variancePct: Number(variancePct.toFixed(1)),
      confidenceScore: Number(confidenceScore.toFixed(1)),
      signalType: "UNDERPAYMENT_RISK" as const,
      riskBand: row.underpaymentRate > 35 || variancePct < -20 ? "HIGH" : row.underpaymentRate > 20 ? "MEDIUM" : "LOW",
      explanation: `${row.payerName} shows ${row.underpaymentRate.toFixed(1)}% underpayment rate with ${variancePct.toFixed(1)}% variance vs expected.`,
    };
  });

  logger.info("Predictive underpayment risk generated", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
    count: predictions.length,
  });
  return predictions;
}

export async function predictPayerVarianceTrend(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  const scope = await resolvePredictiveScope(ctx, input);
  const recentSnapshots = await prisma.payerAnalyticsSnapshot.findMany({
    where: { organizationId: scope.organizationId },
    orderBy: [{ createdAt: "desc" }],
    take: 250,
  });
  const grouped = new Map<string, typeof recentSnapshots>();
  for (const row of recentSnapshots) {
    const rows = grouped.get(row.payerName) ?? [];
    rows.push(row);
    grouped.set(row.payerName, rows);
  }

  const trends = Array.from(grouped.entries()).map(([payerName, rows]) => {
    const ordered = rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(-5);
    const values = ordered.map((row) => decimalToNumber(row.totalVariance));
    const avg = movingAverage(values);
    const slope = values.length >= 2 ? (values[values.length - 1] - values[0]) / (values.length - 1) : 0;
    const predictedNextVariance = avg + slope;
    const confidenceScore = clamp((values.length / 5) * 100, 35, 90);
    return {
      payerName,
      points: values.length,
      averageVariance: Number(avg.toFixed(2)),
      varianceSlope: Number(slope.toFixed(2)),
      predictedNextVariance: Number(predictedNextVariance.toFixed(2)),
      confidenceScore: Number(confidenceScore.toFixed(1)),
      signalType: "UNDERPAYMENT_RISK" as const,
      riskBand: predictedNextVariance < -5000 ? "HIGH" : predictedNextVariance < -1500 ? "MEDIUM" : "LOW",
      explanation: `${payerName} projected variance trend is ${predictedNextVariance.toFixed(2)} based on recent snapshot slope ${slope.toFixed(2)}.`,
    };
  });

  return trends.sort((a, b) => a.predictedNextVariance - b.predictedNextVariance);
}

export async function predictClinicOperationalRisk(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  const scope = await resolvePredictiveScope(ctx, input);
  const [clinicRows, paOps] = await Promise.all([
    getClinicHealthSummary(
      { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
      { organizationId: scope.organizationId },
    ),
    getPAOpsSummary(
      { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
      { organizationId: scope.organizationId },
    ),
  ]);

  const deniedPressure = paOps.totalCases > 0 ? paOps.deniedCount / paOps.totalCases : 0;
  const predictions = clinicRows.map((row) => {
    const projectedRisk = row.riskScore + deniedPressure * 10 + (row.avgDaysToPayment > 35 ? 8 : 0);
    const confidenceScore = clamp((row.reimbursementExpected > 0 ? 80 : 55) + (row.onboardingProgressPct > 0 ? 5 : 0), 35, 95);
    return {
      clinicId: row.clinicId,
      clinicName: row.clinicName,
      currentRiskScore: row.riskScore,
      projectedRiskScore: Number(projectedRisk.toFixed(1)),
      projectedHealthBand: projectedRisk >= 70 ? "AT_RISK" : projectedRisk >= 45 ? "WATCH" : "HEALTHY",
      confidenceScore: Number(confidenceScore.toFixed(1)),
      signalType: row.onboardingProgressPct < 75 ? ("ONBOARDING_DELAY_RISK" as const) : ("PA_DENIAL_RISK" as const),
      explanation: `${row.clinicName} projected risk score is ${projectedRisk.toFixed(1)} based on payment lag, underpayment, and PA denial pressure.`,
    };
  });

  logger.info("Predictive clinic operational risk generated", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
    count: predictions.length,
  });
  return predictions;
}

export async function predictExpectedRevenue(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  const scope = await resolvePredictiveScope(ctx, input);
  const forecastRows = await forecastExpectedReimbursement(
    { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
    { organizationId: scope.organizationId, clinicId: scope.clinicId, limit: 200 },
  );
  const totalExpected = forecastRows.reduce((sum, row) => sum + row.expectedAmount, 0);
  const totalForecast = forecastRows.reduce((sum, row) => sum + row.forecastAmount, 0);
  const delta = totalForecast - totalExpected;
  const confidenceScore = clamp((forecastRows.length / 40) * 100, 35, 90);
  return {
    organizationId: scope.organizationId,
    clinicId: scope.clinicId ?? null,
    caseCount: forecastRows.length,
    totalExpected: Number(totalExpected.toFixed(2)),
    totalForecast: Number(totalForecast.toFixed(2)),
    delta: Number(delta.toFixed(2)),
    deltaPct: totalExpected > 0 ? Number(((delta / totalExpected) * 100).toFixed(1)) : 0,
    confidenceScore: Number(confidenceScore.toFixed(1)),
    signalType: "REVENUE_FORECAST" as const,
    explanation: `Projected reimbursement is ${totalForecast.toFixed(2)} vs expected ${totalExpected.toFixed(2)} over ${forecastRows.length} open cases.`,
    rows: forecastRows,
  };
}

export async function listPredictiveSignals(
  ctx: ServiceContext,
  input: {
    organizationId?: string;
    clinicId?: string;
    signalType?: "PAYMENT_DELAY_RISK" | "UNDERPAYMENT_RISK" | "PA_DENIAL_RISK" | "ONBOARDING_DELAY_RISK" | "REVENUE_FORECAST";
    limit?: number;
  },
) {
  const scope = await resolvePredictiveScope(ctx, input);
  return prisma.predictiveSignal.findMany({
    where: {
      organizationId: scope.organizationId,
      clinicId: scope.clinicId ?? undefined,
      signalType: input.signalType,
    },
    include: { clinic: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: input.limit ?? 100,
  });
}

export async function generatePredictiveSignals(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; automation?: boolean },
) {
  const scope = await resolvePredictiveScope(ctx, input);
  await requirePermission(ctx.actorUserId, Permissions.analytics.manage, {
    scope: "ORGANIZATION",
    organizationId: scope.organizationId,
  });

  const [paymentRisk, underpaymentRisk, payerTrend, clinicRisk, revenueForecast] = await Promise.all([
    predictPaymentTimeline(ctx, scope),
    predictUnderpaymentRisk(ctx, scope),
    predictPayerVarianceTrend(ctx, scope),
    predictClinicOperationalRisk(ctx, scope),
    predictExpectedRevenue(ctx, scope),
  ]);

  const toCreate: Array<{
    organizationId: string;
    clinicId?: string | null;
    payerName?: string | null;
    signalType: "PAYMENT_DELAY_RISK" | "UNDERPAYMENT_RISK" | "PA_DENIAL_RISK" | "ONBOARDING_DELAY_RISK" | "REVENUE_FORECAST";
    predictedOutcome: string;
    confidenceScore: number;
    explanation: string;
  }> = [];

  for (const row of paymentRisk.filter((r) => r.riskBand !== "LOW")) {
    toCreate.push({
      organizationId: scope.organizationId,
      clinicId: row.clinicId,
      signalType: "PAYMENT_DELAY_RISK",
      predictedOutcome: `${row.predictedDaysToPayment.toFixed(1)} days to payment`,
      confidenceScore: row.confidenceScore,
      explanation: row.explanation,
    });
  }
  for (const row of underpaymentRisk.filter((r) => r.riskBand !== "LOW")) {
    toCreate.push({
      organizationId: scope.organizationId,
      payerName: row.payerName,
      signalType: "UNDERPAYMENT_RISK",
      predictedOutcome: `${row.predictedUnderpaymentRate.toFixed(1)}% predicted underpayment`,
      confidenceScore: row.confidenceScore,
      explanation: row.explanation,
    });
  }
  for (const row of payerTrend.filter((r) => r.riskBand === "HIGH")) {
    toCreate.push({
      organizationId: scope.organizationId,
      payerName: row.payerName,
      signalType: "UNDERPAYMENT_RISK",
      predictedOutcome: `${row.predictedNextVariance.toFixed(2)} projected variance`,
      confidenceScore: row.confidenceScore,
      explanation: row.explanation,
    });
  }
  for (const row of clinicRisk.filter((r) => r.projectedHealthBand !== "HEALTHY")) {
    toCreate.push({
      organizationId: scope.organizationId,
      clinicId: row.clinicId,
      signalType: row.signalType,
      predictedOutcome: `${row.projectedHealthBand} (${row.projectedRiskScore.toFixed(1)})`,
      confidenceScore: row.confidenceScore,
      explanation: row.explanation,
    });
  }
  toCreate.push({
    organizationId: scope.organizationId,
    clinicId: scope.clinicId ?? null,
    signalType: "REVENUE_FORECAST",
    predictedOutcome: `${revenueForecast.totalForecast.toFixed(2)} forecasted reimbursement`,
    confidenceScore: revenueForecast.confidenceScore,
    explanation: revenueForecast.explanation,
  });

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const created = [];
  for (const signal of toCreate) {
    const existing = await prisma.predictiveSignal.findFirst({
      where: {
        organizationId: signal.organizationId,
        clinicId: signal.clinicId ?? null,
        payerName: signal.payerName ?? null,
        signalType: signal.signalType,
        predictedOutcome: signal.predictedOutcome,
        createdAt: { gte: cutoff },
      },
      select: { id: true },
    });
    if (existing) continue;
    created.push(
      await prisma.predictiveSignal.create({
        data: {
          organizationId: signal.organizationId,
          clinicId: signal.clinicId ?? null,
          payerName: signal.payerName ?? null,
          signalType: signal.signalType,
          predictedOutcome: signal.predictedOutcome,
          confidenceScore: signal.confidenceScore,
          explanation: signal.explanation,
        },
      }),
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: scope.organizationId, clinicId: scope.clinicId },
    action: "CREATE",
    entityType: "PredictiveSignalBatch",
    entityId: `${created.length}`,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId ?? null,
    metadata: { generated: created.length },
  });

  if (input.automation !== false && created.length > 0) {
    await dispatchPredictiveSignalsToAutomation(
      { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
      {
        organizationId: scope.organizationId,
        signals: created.map((s) => ({
          id: s.id,
          clinicId: s.clinicId,
          payerName: s.payerName,
          signalType: s.signalType,
          predictedOutcome: s.predictedOutcome,
          confidenceScore: s.confidenceScore,
          explanation: s.explanation,
        })),
      },
    );
  }

  logger.info("Predictive signals generated", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
    generated: created.length,
  });

  return created;
}
