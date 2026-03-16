import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import type { ServiceContext } from "@/server/services/service-context";
import { createTask } from "@/server/services/workflow/workflow.service";
import { PriorAuthParentTypes } from "@/server/services/prior-auth/prior-auth.types";

import type { AutomationActionType, AutomationRuleType } from "./automation.types";

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) return 0;
  return Number(value.toString());
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

type RuleTarget = {
  organizationId: string;
  clinicId: string | null;
  entityType:
    | "ReimbursementCase"
    | "PriorAuthorizationCase"
    | "Clinic"
    | "RevenueOptimizationSignal"
    | "PredictiveSignal";
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

async function requireOrgPermission(ctx: ServiceContext, organizationId: string, permission: "read" | "manage") {
  await requirePermission(
    ctx.actorUserId,
    permission === "read" ? Permissions.automation.read : Permissions.automation.manage,
    { scope: "ORGANIZATION", organizationId },
  );
}

export async function listAutomationRules(
  ctx: ServiceContext,
  input: { organizationId: string; isActive?: boolean; limit?: number },
) {
  await requireOrgPermission(ctx, input.organizationId, "read");
  return prisma.automationRule.findMany({
    where: {
      organizationId: input.organizationId,
      isActive: input.isActive,
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      events: {
        orderBy: [{ createdAt: "desc" }],
        take: 3,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: input.limit ?? 100,
  });
}

export async function listAutomationEvents(
  ctx: ServiceContext,
  input: { organizationId: string; limit?: number },
) {
  await requireOrgPermission(ctx, input.organizationId, "read");
  return prisma.automationEvent.findMany({
    where: { organizationId: input.organizationId },
    include: { rule: { select: { id: true, ruleType: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: input.limit ?? 100,
  });
}

export async function createAutomationRule(
  ctx: ServiceContext,
  input: {
    organizationId: string;
    ruleType: AutomationRuleType;
    conditionConfig: Record<string, unknown>;
    actionConfig: { actionType: AutomationActionType } & Record<string, unknown>;
    isActive?: boolean;
  },
) {
  await requireOrgPermission(ctx, input.organizationId, "manage");

  const created = await prisma.automationRule.create({
    data: {
      organizationId: input.organizationId,
      ruleType: input.ruleType,
      conditionConfig: toInputJson(input.conditionConfig),
      actionConfig: toInputJson(input.actionConfig),
      isActive: input.isActive ?? true,
      createdByUserId: ctx.actorUserId,
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: input.organizationId },
    action: "CREATE",
    entityType: "AutomationRule",
    entityId: created.id,
    organizationId: input.organizationId,
    clinicId: null,
    metadata: { ruleType: created.ruleType, isActive: created.isActive },
  });
  logger.info("Automation rule created", { organizationId: input.organizationId, ruleId: created.id });
  return created;
}

export async function updateAutomationRule(
  ctx: ServiceContext,
  ruleId: string,
  input: {
    conditionConfig?: Record<string, unknown>;
    actionConfig?: Record<string, unknown>;
    isActive?: boolean;
  },
) {
  const existing = await prisma.automationRule.findUnique({
    where: { id: ruleId },
    select: { id: true, organizationId: true },
  });
  if (!existing) throw new AppError("Automation rule not found", "NOT_FOUND", 404);
  await requireOrgPermission(ctx, existing.organizationId, "manage");

  const updated = await prisma.automationRule.update({
    where: { id: ruleId },
    data: {
      conditionConfig: input.conditionConfig ? toInputJson(input.conditionConfig) : undefined,
      actionConfig: input.actionConfig ? toInputJson(input.actionConfig) : undefined,
      isActive: input.isActive,
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: existing.organizationId },
    action: "UPDATE",
    entityType: "AutomationRule",
    entityId: updated.id,
    organizationId: existing.organizationId,
    clinicId: null,
    metadata: { isActive: updated.isActive },
  });

  return updated;
}

async function getUnderpaymentTargets(rule: {
  organizationId: string;
  conditionConfig: Prisma.JsonValue;
}): Promise<RuleTarget[]> {
  const condition = (rule.conditionConfig ?? {}) as { threshold?: number; clinicId?: string; payerName?: string };
  const threshold = Number(condition.threshold ?? 1);
  const cases = await prisma.reimbursementCase.findMany({
    where: {
      organizationId: rule.organizationId,
      clinicId: condition.clinicId,
      payerName: condition.payerName
        ? { equals: condition.payerName, mode: "insensitive" }
        : undefined,
      underpaymentFlag: true,
    },
    select: { id: true, clinicId: true, payerName: true, expectedAmount: true },
    take: 200,
  });

  const sums = await prisma.paymentRecord.groupBy({
    by: ["reimbursementCaseId"],
    where: { reimbursementCaseId: { in: cases.map((c) => c.id) } },
    _sum: { paidAmount: true },
  });
  const sumByCase = new Map(sums.map((row) => [row.reimbursementCaseId, decimalToNumber(row._sum.paidAmount)]));

  return cases
    .map((c) => {
      const expected = decimalToNumber(c.expectedAmount);
      const paid = sumByCase.get(c.id) ?? 0;
      const variance = paid - expected;
      return {
        organizationId: rule.organizationId,
        clinicId: c.clinicId,
        entityType: "ReimbursementCase" as const,
        entityId: c.id,
        summary: `Underpayment detected for payer ${c.payerName}`,
        metadata: { expected, paid, variance },
      };
    })
    .filter((target) => Math.abs(Number((target.metadata?.variance as number) ?? 0)) >= threshold);
}

async function getPAStuckTargets(rule: {
  organizationId: string;
  conditionConfig: Prisma.JsonValue;
}): Promise<RuleTarget[]> {
  const condition = (rule.conditionConfig ?? {}) as { daysStuck?: number; clinicId?: string };
  const daysStuck = Number(condition.daysStuck ?? 14);
  const cutoff = new Date(Date.now() - daysStuck * 24 * 60 * 60 * 1000);
  const paCases = await prisma.priorAuthorizationCase.findMany({
    where: {
      organizationId: rule.organizationId,
      clinicId: condition.clinicId,
      status: "PENDING_PAYER",
      updatedAt: { lt: cutoff },
    },
    select: { id: true, clinicId: true, payerName: true, updatedAt: true },
    take: 200,
  });
  return paCases.map((c) => ({
    organizationId: rule.organizationId,
    clinicId: c.clinicId,
    entityType: "PriorAuthorizationCase",
    entityId: c.id,
    summary: `PA case pending payer beyond ${daysStuck} days`,
    metadata: { payerName: c.payerName, updatedAt: c.updatedAt.toISOString(), daysStuck },
  }));
}

async function getPaymentDelayTargets(rule: {
  organizationId: string;
  conditionConfig: Prisma.JsonValue;
}): Promise<RuleTarget[]> {
  const condition = (rule.conditionConfig ?? {}) as { daysDelay?: number; clinicId?: string };
  const daysDelay = Number(condition.daysDelay ?? 30);
  const cutoff = new Date(Date.now() - daysDelay * 24 * 60 * 60 * 1000);
  const cases = await prisma.reimbursementCase.findMany({
    where: {
      organizationId: rule.organizationId,
      clinicId: condition.clinicId,
      createdAt: { lt: cutoff },
    },
    select: { id: true, clinicId: true, createdAt: true, payerName: true },
    take: 300,
  });
  const payments = await prisma.paymentRecord.findMany({
    where: { reimbursementCaseId: { in: cases.map((c) => c.id) } },
    select: { reimbursementCaseId: true, paidDate: true },
    orderBy: [{ paidDate: "asc" }],
  });
  const firstPaymentByCase = new Map<string, Date>();
  for (const payment of payments) {
    if (!firstPaymentByCase.has(payment.reimbursementCaseId)) {
      firstPaymentByCase.set(payment.reimbursementCaseId, payment.paidDate);
    }
  }
  return cases
    .map((c) => {
      const firstPaid = firstPaymentByCase.get(c.id);
      const delayDays = firstPaid
        ? (firstPaid.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        : (Date.now() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return {
        organizationId: rule.organizationId,
        clinicId: c.clinicId,
        entityType: "ReimbursementCase" as const,
        entityId: c.id,
        summary: `Payment delay exceeds ${daysDelay} days`,
        metadata: { payerName: c.payerName, delayDays: Number(delayDays.toFixed(1)) },
      };
    })
    .filter((target) => Number((target.metadata?.delayDays as number) ?? 0) >= daysDelay);
}

async function getDocumentationMissingTargets(rule: {
  organizationId: string;
  conditionConfig: Prisma.JsonValue;
}): Promise<RuleTarget[]> {
  const condition = (rule.conditionConfig ?? {}) as { clinicId?: string };
  const paCases = await prisma.priorAuthorizationCase.findMany({
    where: {
      organizationId: rule.organizationId,
      clinicId: condition.clinicId,
      status: { in: ["SUBMITTED", "PENDING_PAYER", "DENIED"] },
    },
    select: { id: true, clinicId: true, payerName: true },
    take: 300,
  });
  const attachments = await prisma.fileAttachment.groupBy({
    by: ["parentId"],
    where: {
      organizationId: rule.organizationId,
      parentType: PriorAuthParentTypes.case,
      parentId: { in: paCases.map((c) => c.id) },
    },
    _count: { _all: true },
  });
  const attachedCaseIds = new Set(attachments.map((a) => a.parentId));
  return paCases
    .filter((c) => !attachedCaseIds.has(c.id))
    .map((c) => ({
      organizationId: rule.organizationId,
      clinicId: c.clinicId,
      entityType: "PriorAuthorizationCase" as const,
      entityId: c.id,
      summary: "PA case is missing documentation",
      metadata: { payerName: c.payerName },
    }));
}

function getActionType(rule: { actionConfig: Prisma.JsonValue }): AutomationActionType {
  const action = (rule.actionConfig ?? {}) as { actionType?: string };
  if (action.actionType === "createOperationalAlert" || action.actionType === "createTask" || action.actionType === "notifyUser") {
    return action.actionType;
  }
  return "createOperationalAlert";
}

async function hasRecentEvent(input: {
  ruleId: string;
  targetEntityType: string;
  targetEntityId: string;
  actionExecuted: string;
}) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.automationEvent.findFirst({
    where: {
      ruleId: input.ruleId,
      targetEntityType: input.targetEntityType,
      targetEntityId: input.targetEntityId,
      actionExecuted: input.actionExecuted,
      createdAt: { gte: cutoff },
      status: { in: ["SUCCESS", "SKIPPED"] },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function triggerAutomationAction(
  ctx: ServiceContext,
  input: {
    rule: {
      id: string;
      organizationId: string;
      actionConfig: Prisma.JsonValue;
    };
    target: RuleTarget;
  },
) {
  const actionType = getActionType(input.rule);
  const actionConfig = (input.rule.actionConfig ?? {}) as {
    title?: string;
    message?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    assignedToId?: string;
  };

  if (
    await hasRecentEvent({
      ruleId: input.rule.id,
      targetEntityType: input.target.entityType,
      targetEntityId: input.target.entityId,
      actionExecuted: actionType,
    })
  ) {
    return prisma.automationEvent.create({
      data: {
        ruleId: input.rule.id,
        organizationId: input.rule.organizationId,
        triggeredByUserId: ctx.actorUserId,
        triggeredAt: new Date(),
        targetEntityType: input.target.entityType,
        targetEntityId: input.target.entityId,
        actionExecuted: actionType,
        status: "SKIPPED",
        metadata: { reason: "recent_duplicate_suppressed" },
      },
    });
  }

  try {
    if (actionType === "createOperationalAlert") {
      await prisma.activityEvent.create({
        data: {
          organizationId: input.target.organizationId,
          clinicId: input.target.clinicId,
          parentType: "AUTOMATION_TARGET",
          parentId: input.target.entityId,
          type: "AUTOMATION_ALERT",
          title: actionConfig.title ?? "Automation alert",
          description: actionConfig.message ?? input.target.summary,
          createdById: ctx.actorUserId,
          metadata: {
            ruleId: input.rule.id,
            targetEntityType: input.target.entityType,
            ...input.target.metadata,
          },
        },
      });
    } else if (actionType === "createTask") {
      await createTask(
        ctx,
        {
          organizationId: input.target.organizationId,
          clinicId: input.target.clinicId,
          parentType: "AUTOMATION_TARGET",
          parentId: input.target.entityId,
          title: actionConfig.title ?? "Automation follow-up task",
          description: actionConfig.message ?? input.target.summary,
          priority: actionConfig.priority ?? "HIGH",
          assignedToId: actionConfig.assignedToId ?? null,
          status: "TODO",
        },
        { permission: Permissions.automation.manage },
      );
    } else if (actionType === "notifyUser") {
      await prisma.activityEvent.create({
        data: {
          organizationId: input.target.organizationId,
          clinicId: input.target.clinicId,
          parentType: "AUTOMATION_TARGET",
          parentId: input.target.entityId,
          type: "AUTOMATION_NOTIFY",
          title: actionConfig.title ?? "Automation notification",
          description: actionConfig.message ?? input.target.summary,
          createdById: ctx.actorUserId,
          metadata: {
            ruleId: input.rule.id,
            assignedToId: actionConfig.assignedToId ?? null,
            ...input.target.metadata,
          },
        },
      });
    }

    const event = await prisma.automationEvent.create({
      data: {
        ruleId: input.rule.id,
        organizationId: input.rule.organizationId,
        triggeredByUserId: ctx.actorUserId,
        triggeredAt: new Date(),
        targetEntityType: input.target.entityType,
        targetEntityId: input.target.entityId,
        actionExecuted: actionType,
        status: "SUCCESS",
        metadata: toInputJson(input.target.metadata ?? {}),
      },
    });

    logger.info("Automation action executed", {
      ruleId: input.rule.id,
      targetEntityType: input.target.entityType,
      targetEntityId: input.target.entityId,
      actionExecuted: actionType,
    });
    return event;
  } catch (error) {
    const event = await prisma.automationEvent.create({
      data: {
        ruleId: input.rule.id,
        organizationId: input.rule.organizationId,
        triggeredByUserId: ctx.actorUserId,
        triggeredAt: new Date(),
        targetEntityType: input.target.entityType,
        targetEntityId: input.target.entityId,
        actionExecuted: actionType,
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Unknown automation action error",
      },
    });
    logger.error("Automation action failed", {
      ruleId: input.rule.id,
      targetEntityType: input.target.entityType,
      targetEntityId: input.target.entityId,
      actionExecuted: actionType,
    });
    return event;
  }
}

export async function evaluateRule(
  ctx: ServiceContext,
  rule: {
    id: string;
    organizationId: string;
    ruleType: AutomationRuleType;
    conditionConfig: Prisma.JsonValue;
    actionConfig: Prisma.JsonValue;
    isActive: boolean;
  },
) {
  if (!rule.isActive) return { ruleId: rule.id, evaluatedTargets: 0, triggeredEvents: 0, skipped: true };

  let targets: RuleTarget[] = [];
  if (rule.ruleType === "UNDERPAYMENT_ALERT") targets = await getUnderpaymentTargets(rule);
  if (rule.ruleType === "PA_STUCK_ALERT") targets = await getPAStuckTargets(rule);
  if (rule.ruleType === "PAYMENT_DELAY_ALERT") targets = await getPaymentDelayTargets(rule);
  if (rule.ruleType === "DOCUMENTATION_MISSING") targets = await getDocumentationMissingTargets(rule);

  let triggeredEvents = 0;
  for (const target of targets) {
    await triggerAutomationAction(ctx, { rule, target });
    triggeredEvents += 1;
  }

  return { ruleId: rule.id, evaluatedTargets: targets.length, triggeredEvents, skipped: false };
}

export async function evaluateAutomationRules(
  ctx: ServiceContext,
  input: { organizationId: string; ruleId?: string },
) {
  await requireOrgPermission(ctx, input.organizationId, "manage");

  const rules = await prisma.automationRule.findMany({
    where: {
      organizationId: input.organizationId,
      id: input.ruleId,
      isActive: true,
    },
    select: {
      id: true,
      organizationId: true,
      ruleType: true,
      conditionConfig: true,
      actionConfig: true,
      isActive: true,
    },
  });
  if (input.ruleId && rules.length === 0) throw new AppError("Automation rule not found", "NOT_FOUND", 404);

  const results = [];
  for (const rule of rules) {
    const result = await evaluateRule(ctx, {
      ...rule,
      ruleType: rule.ruleType as AutomationRuleType,
    });
    results.push(result);
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: input.organizationId },
    action: "CREATE",
    entityType: "AutomationRun",
    entityId: `${Date.now()}`,
    organizationId: input.organizationId,
    clinicId: null,
    metadata: { ruleCount: rules.length, triggeredEvents: results.reduce((sum, r) => sum + r.triggeredEvents, 0) },
  });

  logger.info("Automation evaluation run completed", {
    organizationId: input.organizationId,
    ruleCount: rules.length,
  });

  return {
    organizationId: input.organizationId,
    ruleCount: rules.length,
    results,
  };
}

export async function dispatchRevenueSignalsToAutomation(
  ctx: ServiceContext,
  input: {
    organizationId: string;
    signals: Array<{
      id: string;
      clinicId: string | null;
      reimbursementCaseId: string | null;
      signalType: "APPEAL_OPPORTUNITY" | "HIGH_VARIANCE_RISK" | "PAYER_PATTERN_ALERT" | "FORECAST_RISK";
      signalSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      explanation: string;
      recommendedAction: string;
    }>;
  },
) {
  await requireOrgPermission(ctx, input.organizationId, "manage");
  const rules = await prisma.automationRule.findMany({
    where: { organizationId: input.organizationId, isActive: true },
    select: { id: true, organizationId: true, ruleType: true, actionConfig: true },
  });

  const mapSignalToRuleTypes = (
    signalType: "APPEAL_OPPORTUNITY" | "HIGH_VARIANCE_RISK" | "PAYER_PATTERN_ALERT" | "FORECAST_RISK",
  ): string[] => {
    if (signalType === "APPEAL_OPPORTUNITY") return ["PA_STUCK_ALERT", "DOCUMENTATION_MISSING"];
    if (signalType === "HIGH_VARIANCE_RISK") return ["UNDERPAYMENT_ALERT"];
    if (signalType === "PAYER_PATTERN_ALERT") return ["UNDERPAYMENT_ALERT"];
    return ["PAYMENT_DELAY_ALERT"];
  };

  let executed = 0;
  for (const signal of input.signals) {
    if (signal.signalSeverity === "LOW") continue;
    const applicableRuleTypes = mapSignalToRuleTypes(signal.signalType);
    const target: RuleTarget = {
      organizationId: input.organizationId,
      clinicId: signal.clinicId,
      entityType: signal.reimbursementCaseId ? "ReimbursementCase" : "RevenueOptimizationSignal",
      entityId: signal.reimbursementCaseId ?? signal.id,
      summary: signal.explanation,
      metadata: { signalId: signal.id, signalType: signal.signalType, signalSeverity: signal.signalSeverity },
    };

    for (const rule of rules.filter((r) => applicableRuleTypes.includes(r.ruleType))) {
      await triggerAutomationAction(ctx, { rule, target });
      executed += 1;
    }
  }

  logger.info("Revenue signals dispatched to automation", {
    organizationId: input.organizationId,
    signalCount: input.signals.length,
    executedActions: executed,
  });
  return { signalCount: input.signals.length, executedActions: executed };
}

export async function dispatchPredictiveSignalsToAutomation(
  ctx: ServiceContext,
  input: {
    organizationId: string;
    signals: Array<{
      id: string;
      clinicId: string | null;
      payerName: string | null;
      signalType: "PAYMENT_DELAY_RISK" | "UNDERPAYMENT_RISK" | "PA_DENIAL_RISK" | "ONBOARDING_DELAY_RISK" | "REVENUE_FORECAST";
      predictedOutcome: string;
      confidenceScore: number;
      explanation: string;
    }>;
  },
) {
  await requireOrgPermission(ctx, input.organizationId, "manage");
  const rules = await prisma.automationRule.findMany({
    where: { organizationId: input.organizationId, isActive: true },
    select: { id: true, organizationId: true, ruleType: true, actionConfig: true },
  });

  const mapSignalToRuleTypes = (
    signalType: "PAYMENT_DELAY_RISK" | "UNDERPAYMENT_RISK" | "PA_DENIAL_RISK" | "ONBOARDING_DELAY_RISK" | "REVENUE_FORECAST",
  ): string[] => {
    if (signalType === "PAYMENT_DELAY_RISK") return ["PAYMENT_DELAY_ALERT"];
    if (signalType === "UNDERPAYMENT_RISK") return ["UNDERPAYMENT_ALERT"];
    if (signalType === "PA_DENIAL_RISK") return ["PA_STUCK_ALERT"];
    if (signalType === "ONBOARDING_DELAY_RISK") return ["DOCUMENTATION_MISSING"];
    return ["UNDERPAYMENT_ALERT", "PAYMENT_DELAY_ALERT"];
  };

  let executed = 0;
  for (const signal of input.signals) {
    if (signal.confidenceScore < 55) continue;
    const target: RuleTarget = {
      organizationId: input.organizationId,
      clinicId: signal.clinicId,
      entityType: "PredictiveSignal",
      entityId: signal.id,
      summary: signal.explanation,
      metadata: {
        signalType: signal.signalType,
        confidenceScore: signal.confidenceScore,
        predictedOutcome: signal.predictedOutcome,
        payerName: signal.payerName,
      },
    };
    const applicableRuleTypes = mapSignalToRuleTypes(signal.signalType);
    for (const rule of rules.filter((r) => applicableRuleTypes.includes(r.ruleType))) {
      await triggerAutomationAction(ctx, { rule, target });
      executed += 1;
    }
  }

  logger.info("Predictive signals dispatched to automation", {
    organizationId: input.organizationId,
    signalCount: input.signals.length,
    executedActions: executed,
  });
  return { signalCount: input.signals.length, executedActions: executed };
}
