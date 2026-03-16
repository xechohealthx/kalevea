import { AppError } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import type { ServiceContext } from "@/server/services/service-context";
import { getClinicBenchmarkSummary } from "@/server/services/analytics/network-benchmark.service";
import {
  getNetworkReimbursementSummary,
  listUnderpaidCases,
} from "@/server/services/analytics/reimbursement-analytics.service";
import { getOperationalAlerts } from "@/server/services/analytics/command-center.service";
import { listPACases } from "@/server/services/prior-auth/prior-auth.service";
import { listPayerRules } from "@/server/services/payer-rules/payer-rule.service";
import { listOnboardingProjects, getOnboardingProject } from "@/server/services/onboarding/onboarding.service";
import {
  getRevenueOpportunities,
  listRevenueOptimizationSignals,
} from "@/server/services/analytics/revenue-optimization.service";

import type { KalIntent } from "./kal.schemas";

export type KalToolName =
  | "getClinicBenchmarkSummary"
  | "getReimbursementVariance"
  | "listUnderpaidCases"
  | "getUnderpaidCases"
  | "getRevenueSignals"
  | "getPayerRules"
  | "getAutomationAlerts"
  | "getOnboardingProgress"
  | "getPAAttentionCases"
  | "getRevenueOpportunities";

type KalContextScope = {
  organizationId: string;
  clinicId?: string;
};

export async function resolveKalScopeForAssistant(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
): Promise<KalContextScope> {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const organizationId = input.organizationId ?? access.defaultOrganizationId ?? undefined;
  if (!organizationId) throw new AppError("No organization access", "UNAUTHORIZED", 403);

  await requirePermission(ctx.actorUserId, Permissions.aiAssistant.read, {
    scope: "ORGANIZATION",
    organizationId,
  });

  if (!input.clinicId) return { organizationId };
  if (access.globalRoleKeys.length > 0 || access.accessibleClinicIds.includes(input.clinicId)) {
    return { organizationId, clinicId: input.clinicId };
  }
  throw new AppError("Clinic is outside access scope", "UNAUTHORIZED", 403);
}

function scrubFreeText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]");
}

function withSafeErrorMessage(err: unknown) {
  if (err instanceof AppError) return err.message;
  return "context unavailable";
}

export async function runKalTool(
  ctx: ServiceContext,
  scope: KalContextScope,
  toolName: KalToolName,
): Promise<{ toolName: KalToolName; data: unknown; unavailable?: string }> {
  try {
    if (toolName === "getClinicBenchmarkSummary") {
      const rows = await getClinicBenchmarkSummary(
        { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
        { organizationId: scope.organizationId },
      );
      return {
        toolName,
        data: rows.slice(0, 15).map((row) => ({
          clinicId: row.clinicId,
          clinicName: row.clinicName,
          avgDaysToPayment: row.avgDaysToPayment,
          paApprovalRate: row.paApprovalRate,
          underpaymentRate: row.underpaymentRate,
        })),
      };
    }

    if (toolName === "getReimbursementVariance") {
      const summary = await getNetworkReimbursementSummary(
        { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
        { clinicId: scope.clinicId },
      );
      return {
        toolName,
        data: {
          totalCases: summary.totalCases,
          totalExpected: summary.totalExpected,
          totalPaid: summary.totalPaid,
          totalVariance: summary.totalVariance,
          underpaymentRate: summary.underpaymentRate,
        },
      };
    }

    if (toolName === "listUnderpaidCases" || toolName === "getUnderpaidCases") {
      const rows = await listUnderpaidCases(
        { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
        { clinicId: scope.clinicId, limit: 25 },
      );
      return {
        toolName,
        data: rows.map((row) => ({
          id: row.id,
          clinicName: row.clinic.name,
          payerName: row.payerName,
          status: row.status,
          expectedAmount: row.expectedAmount,
          totalPaid: row.totalPaid,
          varianceAmount: row.varianceAmount,
        })),
      };
    }

    if (toolName === "getRevenueSignals") {
      const rows = await listRevenueOptimizationSignals(
        { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
        { organizationId: scope.organizationId, clinicId: scope.clinicId, limit: 25 },
      );
      return {
        toolName,
        data: rows.map((row) => ({
          id: row.id,
          signalType: row.signalType,
          signalSeverity: row.signalSeverity,
          payerName: row.payerName,
          clinicName: row.clinic?.name ?? null,
          recommendedAction: row.recommendedAction,
        })),
      };
    }

    if (toolName === "getPayerRules") {
      const rows = await listPayerRules(
        { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
        { organizationId: scope.organizationId, clinicId: scope.clinicId, isActive: true, limit: 20 },
      );
      return {
        toolName,
        data: rows.map((row) => ({
          id: row.id,
          payerName: row.payerName,
          ruleCategory: row.ruleCategory,
          title: row.title,
          confidenceLevel: row.confidenceLevel,
          serviceContext: row.serviceContext,
        })),
      };
    }

    if (toolName === "getAutomationAlerts") {
      const rows = await getOperationalAlerts(
        { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
        { organizationId: scope.organizationId },
      );
      return { toolName, data: rows.slice(0, 15) };
    }

    if (toolName === "getOnboardingProgress") {
      const projects = await listOnboardingProjects({
        actorUserId: ctx.actorUserId,
        organizationId: scope.organizationId,
        clinicId: scope.clinicId,
      });
      const filtered = scope.clinicId ? projects.filter((project) => project.clinicId === scope.clinicId) : projects;
      const top = filtered.slice(0, 6);

      const details = await Promise.all(
        top.map(async (project) => {
          const detail = await getOnboardingProject(
            { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: project.clinicId },
            project.id,
          );
          const total = detail.tasks.length;
          const done = detail.tasks.filter((task) => task.status === "DONE").length;
          const blocked = detail.tasks.filter((task) => task.status === "BLOCKED").length;
          const inProgress = detail.tasks.filter((task) => task.status === "IN_PROGRESS").length;
          return {
            projectId: detail.id,
            clinicId: detail.clinic.id,
            clinicName: detail.clinic.name,
            status: detail.status,
            totalTasks: total,
            doneTasks: done,
            blockedTasks: blocked,
            inProgressTasks: inProgress,
            progressPct: total > 0 ? (done / total) * 100 : 0,
            blockers: detail.tasks
              .filter((task) => task.status === "BLOCKED")
              .slice(0, 5)
              .map((task) => ({ title: task.title, category: task.category })),
          };
        }),
      );
      return { toolName, data: details };
    }

    if (toolName === "getPAAttentionCases") {
      const rows = await listPACases(
        { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
        { clinicId: scope.clinicId, limit: 25 },
      );
      return {
        toolName,
        data: rows
          .filter((row) => ["SUBMITTED", "PENDING_PAYER", "DENIED"].includes(row.status))
          .map((row) => ({
            id: row.id,
            clinicName: row.clinic?.name ?? row.clinicId,
            payerName: row.payerName,
            medicationName: row.medicationName,
            status: row.status,
            updatedAt: row.updatedAt,
          })),
      };
    }

    const opportunities = await getRevenueOpportunities(
      { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: scope.clinicId },
      { organizationId: scope.organizationId, clinicId: scope.clinicId, limit: 20 },
    );
    return { toolName, data: opportunities };
  } catch (err) {
    logger.warn("Kal tool unavailable", {
      actorUserId: ctx.actorUserId,
      organizationId: scope.organizationId,
      clinicId: scope.clinicId,
      toolName,
      reason: withSafeErrorMessage(err),
    });
    return { toolName, data: null, unavailable: withSafeErrorMessage(err) };
  }
}

function selectToolsForIntent(intent: KalIntent): KalToolName[] {
  if (intent === "onboarding") {
    return ["getOnboardingProgress", "getAutomationAlerts"];
  }
  if (intent === "reimbursement") {
    return ["getReimbursementVariance", "getUnderpaidCases", "getRevenueSignals", "getPayerRules", "getRevenueOpportunities"];
  }
  if (intent === "benchmarking") {
    return ["getClinicBenchmarkSummary", "getReimbursementVariance", "getAutomationAlerts"];
  }
  if (intent === "prior_auth") {
    return ["getPAAttentionCases", "getAutomationAlerts", "getPayerRules"];
  }
  if (intent === "revenue") {
    return ["getRevenueOpportunities", "getRevenueSignals", "getReimbursementVariance", "getUnderpaidCases", "getPayerRules"];
  }
  if (intent === "predictive") {
    return ["getClinicBenchmarkSummary", "getRevenueSignals", "getReimbursementVariance", "getRevenueOpportunities", "getAutomationAlerts"];
  }
  if (intent === "operations") {
    return ["getAutomationAlerts", "getPAAttentionCases", "getOnboardingProgress", "getReimbursementVariance"];
  }
  return [
    "getReimbursementVariance",
    "getUnderpaidCases",
    "getRevenueSignals",
    "getPayerRules",
    "getClinicBenchmarkSummary",
    "getPAAttentionCases",
    "getAutomationAlerts",
    "getOnboardingProgress",
    "getRevenueOpportunities",
  ];
}

export async function buildKalContext(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; intent: KalIntent; query?: string },
) {
  const scope = await resolveKalScopeForAssistant(ctx, input);
  const tools = selectToolsForIntent(input.intent);
  const toolOutputs = await Promise.all(tools.map((toolName) => runKalTool(ctx, scope, toolName)));

  const context = {
    organizationId: scope.organizationId,
    clinicId: scope.clinicId ?? null,
    intent: input.intent,
    query: input.query ? scrubFreeText(input.query) : undefined,
    tools: toolOutputs,
  };

  logger.info("Kal context built", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
    intent: input.intent,
    toolCount: tools.length,
  });

  return context;
}
