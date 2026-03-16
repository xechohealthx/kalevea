import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import type { ServiceContext } from "@/server/services/service-context";
import { askKal } from "@/server/services/ai/kal-assistant.service";
import { analyzeClinicOperationalRisk, analyzeRevenueAnomalies } from "@/server/services/ai/kal-diagnostics.service";
import { listRevenueOptimizationSignals } from "@/server/services/analytics/revenue-optimization.service";

export async function explainDashboardMetrics(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; query?: string },
) {
  const result = await askKal(ctx, {
    query:
      input.query ??
      "Explain this operational dashboard. Describe what the key numbers mean, highlight anomalies, and list the top operator investigations.",
    organizationId: input.organizationId,
    clinicId: input.clinicId,
    intent: "operations",
    includeContext: false,
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: input.organizationId, clinicId: input.clinicId },
    action: "CREATE",
    entityType: "KalExplainDashboard",
    entityId: `${Date.now()}`,
    organizationId: input.organizationId,
    clinicId: input.clinicId ?? null,
    metadata: { recommendationCount: result.answer.recommendedActions.length },
  });

  logger.info("Kal dashboard explanation generated", {
    actorUserId: ctx.actorUserId,
    organizationId: input.organizationId,
    clinicId: input.clinicId,
  });
  return result.answer;
}

export async function explainClinicPerformance(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId: string; query?: string },
) {
  const [riskRows, ai] = await Promise.all([
    analyzeClinicOperationalRisk(ctx, input),
    askKal(ctx, {
      query:
        input.query ??
        "Explain this clinic's operational performance and why it may be outperforming or underperforming network peers.",
      organizationId: input.organizationId,
      clinicId: input.clinicId,
      intent: "benchmarking",
    }),
  ]);
  return {
    clinicRisk: riskRows[0] ?? null,
    explanation: ai.answer,
  };
}

export async function explainReimbursementVariance(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; query?: string },
) {
  const [anomaly, ai] = await Promise.all([
    analyzeRevenueAnomalies(ctx, input),
    askKal(ctx, {
      query:
        input.query ??
        "Explain the current reimbursement variance pattern and identify likely causes with priority investigations.",
      organizationId: input.organizationId,
      clinicId: input.clinicId,
      intent: "reimbursement",
    }),
  ]);
  return {
    anomaly,
    explanation: ai.answer,
  };
}

export async function explainUnderpaymentSignal(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; signalId?: string; query?: string },
) {
  const signals = await listRevenueOptimizationSignals(ctx, {
    organizationId: input.organizationId,
    clinicId: input.clinicId,
    limit: 25,
  });
  const signal = input.signalId ? signals.find((row) => row.id === input.signalId) ?? null : signals[0] ?? null;
  const ai = await askKal(ctx, {
    query:
      input.query ??
      (signal
        ? `Explain this underpayment signal: ${signal.signalType} ${signal.signalSeverity} ${signal.explanation}`
        : "Explain the top underpayment signal and what operations should do next."),
    organizationId: input.organizationId,
    clinicId: input.clinicId,
    intent: "revenue",
  });
  return {
    signal: signal
      ? {
          id: signal.id,
          signalType: signal.signalType,
          signalSeverity: signal.signalSeverity,
          payerName: signal.payerName,
          clinicName: signal.clinic?.name ?? null,
          explanation: signal.explanation,
          recommendedAction: signal.recommendedAction,
        }
      : null,
    explanation: ai.answer,
  };
}
