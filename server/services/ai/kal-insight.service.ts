import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import type { ServiceContext } from "@/server/services/service-context";
import { getClinicBenchmarkSummary } from "@/server/services/analytics/network-benchmark.service";
import { getNetworkReimbursementSummary } from "@/server/services/analytics/reimbursement-analytics.service";
import { getPayerPerformanceSummary } from "@/server/services/analytics/reimbursement-analytics.service";
import { listRevenueOptimizationSignals } from "@/server/services/analytics/revenue-optimization.service";

function round(value: number) {
  return Number(value.toFixed(1));
}

async function resolveInsightScope(ctx: ServiceContext, input: { organizationId?: string; clinicId?: string }) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const organizationId = input.organizationId ?? access.defaultOrganizationId ?? undefined;
  if (!organizationId) throw new Error("No organization access");
  await requirePermission(ctx.actorUserId, Permissions.aiAssistant.read, {
    scope: "ORGANIZATION",
    organizationId,
  });
  return { organizationId, clinicId: input.clinicId };
}

export async function getClinicInsights(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; limit?: number },
) {
  const scope = await resolveInsightScope(ctx, input);
  const rows = await getClinicBenchmarkSummary(
    { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
    { organizationId: scope.organizationId },
  );
  const avgPaymentLag = rows.length > 0 ? rows.reduce((acc, row) => acc + row.avgDaysToPayment, 0) / rows.length : 0;

  const insights = rows
    .slice(0, input.limit ?? 6)
    .map((row) => {
      const lagDeltaPct = avgPaymentLag > 0 ? ((row.avgDaysToPayment - avgPaymentLag) / avgPaymentLag) * 100 : 0;
      const severity: "LOW" | "MEDIUM" | "HIGH" =
        lagDeltaPct > 25 || row.underpaymentRate > 40 ? "HIGH" : lagDeltaPct > 10 || row.underpaymentRate > 25 ? "MEDIUM" : "LOW";
      return {
        type: "CLINIC_PERFORMANCE",
        severity,
        title: `${row.clinicName} clinic performance signal`,
        message: `${row.clinicName} payment timeline is ${round(lagDeltaPct)}% vs network average with ${round(row.underpaymentRate)}% underpayment rate.`,
        clinicId: row.clinicId,
      };
    });

  logger.info("Kal clinic insights generated", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    count: insights.length,
  });
  return insights;
}

export async function getPayerInsights(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; limit?: number },
) {
  const scope = await resolveInsightScope(ctx, input);
  const rows = await getPayerPerformanceSummary(
    { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
    { clinicId: scope.clinicId, limit: input.limit ?? 10 },
  );

  const insights = rows.map((row) => {
    const variancePct = row.totalExpected > 0 ? (row.totalVariance / row.totalExpected) * 100 : 0;
    const severity: "LOW" | "MEDIUM" | "HIGH" =
      variancePct <= -20 || row.underpaymentRate > 40 ? "HIGH" : variancePct <= -10 || row.underpaymentRate > 25 ? "MEDIUM" : "LOW";
    return {
      type: "PAYER_PERFORMANCE",
      severity,
      title: `${row.payerName} payer variance insight`,
      message: `${row.payerName} is at ${round(variancePct)}% variance against expected with ${round(row.underpaymentRate)}% underpayment rate.`,
      payerName: row.payerName,
    };
  });

  logger.info("Kal payer insights generated", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    count: insights.length,
  });
  return insights;
}

export async function getRevenueInsights(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; limit?: number },
) {
  const scope = await resolveInsightScope(ctx, input);
  const [network, signals] = await Promise.all([
    getNetworkReimbursementSummary(
      { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
      { clinicId: scope.clinicId },
    ),
    listRevenueOptimizationSignals(
      { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
      { organizationId: scope.organizationId, clinicId: scope.clinicId, limit: input.limit ?? 8 },
    ),
  ]);

  const critical = signals.filter((signal) => signal.signalSeverity === "CRITICAL").length;
  const high = signals.filter((signal) => signal.signalSeverity === "HIGH").length;
  const insights = [
    {
      type: "REVENUE_SUMMARY",
      severity: critical > 0 ? "HIGH" : high > 0 ? "MEDIUM" : "LOW",
      title: "Revenue variance posture",
      message: `Open variance is ${network.totalVariance.toFixed(2)} across ${network.totalCases} cases with ${network.underpaymentRate.toFixed(1)}% underpayment rate.`,
    },
    ...signals.slice(0, input.limit ?? 8).map((signal) => ({
      type: "REVENUE_SIGNAL",
      severity:
        signal.signalSeverity === "CRITICAL" ? "HIGH" : signal.signalSeverity === "HIGH" ? "MEDIUM" : "LOW",
      title: `${signal.signalType} · ${signal.signalSeverity}`,
      message: signal.explanation,
      signalId: signal.id,
      payerName: signal.payerName ?? undefined,
      clinicName: signal.clinic?.name ?? undefined,
    })),
  ];

  logger.info("Kal revenue insights generated", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    count: insights.length,
  });
  return insights;
}
