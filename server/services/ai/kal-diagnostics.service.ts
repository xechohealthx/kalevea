import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import type { ServiceContext } from "@/server/services/service-context";
import { getRevenueOpsSummary, getClinicHealthSummary, getPAOpsSummary } from "@/server/services/analytics/command-center.service";
import { getRevenueOpportunities } from "@/server/services/analytics/revenue-optimization.service";

async function resolveScope(ctx: ServiceContext, input: { organizationId?: string; clinicId?: string }) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const organizationId = input.organizationId ?? access.defaultOrganizationId ?? undefined;
  if (!organizationId) throw new AppError("No organization access", "UNAUTHORIZED", 403);
  await requirePermission(ctx.actorUserId, Permissions.aiAssistant.read, {
    scope: "ORGANIZATION",
    organizationId,
  });
  return { organizationId, clinicId: input.clinicId };
}

export async function analyzeRevenueAnomalies(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  const scope = await resolveScope(ctx, input);
  const [revenueOps, opportunities] = await Promise.all([
    getRevenueOpsSummary(
      { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
      { organizationId: scope.organizationId },
    ),
    getRevenueOpportunities(
      { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
      { organizationId: scope.organizationId, clinicId: scope.clinicId, limit: 20 },
    ),
  ]);

  const topNegativePayers = revenueOps.topPayersByVariance.filter((row) => row.variance < 0).slice(0, 5);
  const rootCauses = [
    topNegativePayers.length > 0 ? "payer contract or policy variance concentration" : null,
    opportunities.appealCandidates.length > 0 ? "denied/rejected claim follow-up backlog" : null,
    opportunities.underpaymentOpportunities.length > 0 ? "underpayment cluster in open reimbursement cases" : null,
  ].filter(Boolean);

  const result = {
    organizationId: scope.organizationId,
    clinicId: scope.clinicId ?? null,
    anomalyLevel:
      opportunities.appealCandidates.length > 10 || opportunities.underpaymentOpportunities.length > 10 ? "HIGH" : "MEDIUM",
    topNegativePayers,
    rootCauses,
    openVariance: revenueOps.totalOpenVariance,
    underpaymentCount: revenueOps.underpaymentCount,
  };
  logger.info("Kal revenue anomaly analysis executed", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
  });
  return result;
}

export async function analyzePAWorkflowIssues(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  const scope = await resolveScope(ctx, input);
  const paOps = await getPAOpsSummary(
    { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
    { organizationId: scope.organizationId },
  );
  const issueLevel =
    paOps.pendingBacklog > 20 || paOps.deniedCount > 10 ? "HIGH" : paOps.pendingBacklog > 10 ? "MEDIUM" : "LOW";
  const likelyCauses = [
    paOps.pendingBacklog > 10 ? "pending payer follow-up throughput bottleneck" : null,
    paOps.deniedCount > 6 ? "documentation or criteria mismatch with payer policy" : null,
    paOps.payerConcentration.length > 0 ? "high payer concentration risk in PA volume" : null,
  ].filter(Boolean);

  logger.info("Kal PA workflow diagnostics executed", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
  });
  return {
    organizationId: scope.organizationId,
    clinicId: scope.clinicId ?? null,
    issueLevel,
    pendingBacklog: paOps.pendingBacklog,
    deniedCount: paOps.deniedCount,
    approvalRate: paOps.approvalRate,
    likelyCauses,
    topPayers: paOps.payerConcentration.slice(0, 5),
  };
}

export async function analyzeClinicOperationalRisk(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  const scope = await resolveScope(ctx, input);
  const rows = await getClinicHealthSummary(
    { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
    { organizationId: scope.organizationId },
  );
  const filtered = scope.clinicId ? rows.filter((row) => row.clinicId === scope.clinicId) : rows;

  logger.info("Kal clinic operational risk diagnostics executed", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
    clinicCount: filtered.length,
  });

  return filtered.slice(0, 10).map((row) => ({
    clinicId: row.clinicId,
    clinicName: row.clinicName,
    healthBand: row.healthBand,
    riskScore: row.riskScore,
    riskDrivers: [
      row.avgDaysToPayment > 35 ? "slow payment timelines" : null,
      row.underpaymentRate > 30 ? "underpayment concentration" : null,
      row.paApprovalRate < 60 ? "low PA approval rate" : null,
      row.openSupport > 8 ? "support backlog pressure" : null,
      row.onboardingProgressPct < 70 ? "incomplete onboarding execution" : null,
    ].filter(Boolean),
  }));
}
