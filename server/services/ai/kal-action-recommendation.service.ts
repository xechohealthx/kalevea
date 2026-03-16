import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import type { ServiceContext } from "@/server/services/service-context";
import { analyzeRevenueAnomalies, analyzePAWorkflowIssues, analyzeClinicOperationalRisk } from "@/server/services/ai/kal-diagnostics.service";
import { analyzeClinicOnboardingReadiness } from "@/server/services/ai/kal-onboarding-analysis.service";

type Recommendation = {
  title: string;
  reason: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  actionType: "createTask" | "createOperationalAlert" | "notifyUser" | "reviewOnly";
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  requiresHumanConfirmation: true;
};

export async function generateOperationalActions(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; limit?: number },
) {
  const [revenue, pa, clinics, onboarding] = await Promise.all([
    analyzeRevenueAnomalies(ctx, input),
    analyzePAWorkflowIssues(ctx, input),
    analyzeClinicOperationalRisk(ctx, input),
    analyzeClinicOnboardingReadiness(ctx, input),
  ]);

  const actions: Recommendation[] = [];

  if (revenue.underpaymentCount > 0) {
    actions.push({
      title: "Review highest underpayment payer pattern",
      reason: "Revenue anomaly analysis detected an underpayment cluster across reimbursement operations.",
      priority: revenue.anomalyLevel === "HIGH" ? "HIGH" : "MEDIUM",
      actionType: "createTask",
      targetEntityType: "RevenueOptimizationSignal",
      targetEntityId: null,
      requiresHumanConfirmation: true,
    });
  }

  if (pa.pendingBacklog > 10) {
    actions.push({
      title: "Create PA backlog triage worklist",
      reason: `PA backlog is ${pa.pendingBacklog} with ${pa.deniedCount} denied cases requiring follow-up.`,
      priority: pa.issueLevel === "HIGH" ? "HIGH" : "MEDIUM",
      actionType: "createTask",
      targetEntityType: "PriorAuthorizationCase",
      targetEntityId: null,
      requiresHumanConfirmation: true,
    });
  }

  const atRiskClinics = clinics.filter((clinic) => clinic.healthBand === "AT_RISK");
  if (atRiskClinics.length > 0) {
    actions.push({
      title: "Escalate at-risk clinics in command center review",
      reason: `${atRiskClinics.length} clinics are in AT_RISK band with operational risk drivers.`,
      priority: "HIGH",
      actionType: "createOperationalAlert",
      targetEntityType: "Clinic",
      targetEntityId: atRiskClinics[0]?.clinicId ?? null,
      requiresHumanConfirmation: true,
    });
  }

  const onboardingAtRisk = onboarding.filter((item) => item.readinessBand !== "READY");
  if (onboardingAtRisk.length > 0) {
    actions.push({
      title: "Resolve onboarding readiness blockers",
      reason: `${onboardingAtRisk.length} clinic onboarding projects are not in READY state.`,
      priority: onboardingAtRisk.length > 2 ? "HIGH" : "MEDIUM",
      actionType: "notifyUser",
      targetEntityType: "ClinicOnboardingProject",
      targetEntityId: onboardingAtRisk[0]?.projectId ?? null,
      requiresHumanConfirmation: true,
    });
  }

  const deduped = actions.slice(0, input.limit ?? 8);
  const organizationId = revenue.organizationId;

  await writeAuditLog({
    ctx: { ...ctx, organizationId, clinicId: input.clinicId },
    action: "CREATE",
    entityType: "KalActionRecommendations",
    entityId: `${deduped.length}`,
    organizationId,
    clinicId: input.clinicId ?? null,
    metadata: { recommendationCount: deduped.length },
  });

  logger.info("Kal action recommendations generated", {
    actorUserId: ctx.actorUserId,
    organizationId,
    clinicId: input.clinicId,
    recommendationCount: deduped.length,
  });

  return deduped;
}
