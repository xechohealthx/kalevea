import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import type { ServiceContext } from "@/server/services/service-context";

import type {
  PayerRuleCategory,
  PayerRuleConfidenceLevel,
  PayerRuleSourceType,
  PayerRuleSuggestionStatus,
} from "./payer-rule.types";

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (!value) return null;
  return Number(value.toString());
}

async function ensureReadScope(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  if (input.clinicId) {
    await requirePermission(ctx.actorUserId, Permissions.payerRules.read, {
      scope: "CLINIC",
      clinicId: input.clinicId,
    });
    return { access, hasGlobal: access.globalRoleKeys.length > 0 };
  }

  if (input.organizationId) {
    await requirePermission(ctx.actorUserId, Permissions.payerRules.read, {
      scope: "ORGANIZATION",
      organizationId: input.organizationId,
    });
    return { access, hasGlobal: access.globalRoleKeys.length > 0 };
  }

  const hasGlobal = access.globalRoleKeys.length > 0;
  if (hasGlobal) {
    await requirePermission(ctx.actorUserId, Permissions.payerRules.read, { scope: "GLOBAL" });
    return { access, hasGlobal };
  }

  const firstClinicId = access.accessibleClinicIds[0];
  if (!firstClinicId) throw new AppError("No clinic access", "UNAUTHORIZED", 403);
  await requirePermission(ctx.actorUserId, Permissions.payerRules.read, {
    scope: "CLINIC",
    clinicId: firstClinicId,
  });
  return { access, hasGlobal };
}

async function ensureManageScope(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  if (input.clinicId) {
    await requirePermission(ctx.actorUserId, Permissions.payerRules.manage, {
      scope: "CLINIC",
      clinicId: input.clinicId,
    });
    return;
  }
  if (input.organizationId) {
    await requirePermission(ctx.actorUserId, Permissions.payerRules.manage, {
      scope: "ORGANIZATION",
      organizationId: input.organizationId,
    });
    return;
  }
  await requirePermission(ctx.actorUserId, Permissions.payerRules.manage, { scope: "GLOBAL" });
}

export async function listPayerRules(
  ctx: ServiceContext,
  input?: {
    organizationId?: string;
    clinicId?: string;
    payerName?: string;
    category?: PayerRuleCategory;
    isActive?: boolean;
    limit?: number;
  },
) {
  const { access, hasGlobal } = await ensureReadScope(ctx, {
    organizationId: input?.organizationId,
    clinicId: input?.clinicId,
  });

  return prisma.payerRule.findMany({
    where: {
      OR:
        input?.organizationId || !hasGlobal
          ? [
              {
                organizationId: input?.organizationId ?? {
                  in: access.accessibleOrganizationIds,
                },
              },
              { organizationId: null },
            ]
          : undefined,
      clinicId: input?.clinicId,
      payerName: input?.payerName
        ? {
            contains: input.payerName,
            mode: "insensitive",
          }
        : undefined,
      ruleCategory: input?.category,
      isActive: input?.isActive,
    },
    include: {
      clinic: { select: { id: true, name: true } },
      medicationCatalogItem: { select: { id: true, name: true, ndc: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      evidence: {
        include: {
          document: { select: { id: true, title: true, category: true, createdAt: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 3,
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: input?.limit ?? 100,
  });
}

export async function createPayerRule(
  ctx: ServiceContext,
  input: {
    organizationId?: string;
    clinicId?: string;
    payerName: string;
    ruleCategory: PayerRuleCategory;
    title: string;
    description?: string;
    medicationCatalogItemId?: string;
    stateCode?: string;
    serviceContext?: string;
    expectedReimbursementAmount?: number;
    expectedReimbursementMin?: number;
    expectedReimbursementMax?: number;
    confidenceLevel?: PayerRuleConfidenceLevel;
    sourceType?: PayerRuleSourceType;
    isActive?: boolean;
    effectiveDate?: Date;
    endDate?: Date;
    evidenceDocumentId?: string;
    evidenceSourceLabel?: string;
    evidenceNote?: string;
  },
) {
  await ensureManageScope(ctx, { organizationId: input.organizationId, clinicId: input.clinicId });

  const created = await prisma.payerRule.create({
    data: {
      organizationId: input.organizationId ?? null,
      clinicId: input.clinicId ?? null,
      payerName: input.payerName,
      ruleCategory: input.ruleCategory,
      title: input.title,
      description: input.description ?? null,
      medicationCatalogItemId: input.medicationCatalogItemId ?? null,
      stateCode: input.stateCode ?? null,
      serviceContext: input.serviceContext ?? null,
      expectedReimbursementAmount:
        input.expectedReimbursementAmount !== undefined
          ? new Prisma.Decimal(input.expectedReimbursementAmount)
          : null,
      expectedReimbursementMin:
        input.expectedReimbursementMin !== undefined
          ? new Prisma.Decimal(input.expectedReimbursementMin)
          : null,
      expectedReimbursementMax:
        input.expectedReimbursementMax !== undefined
          ? new Prisma.Decimal(input.expectedReimbursementMax)
          : null,
      confidenceLevel: input.confidenceLevel ?? "MEDIUM",
      sourceType: input.sourceType ?? "MANUAL",
      isActive: input.isActive ?? true,
      effectiveDate: input.effectiveDate ?? null,
      endDate: input.endDate ?? null,
      createdByUserId: ctx.actorUserId,
      evidence: input.evidenceDocumentId
        ? {
            create: {
              documentId: input.evidenceDocumentId,
              sourceLabel: input.evidenceSourceLabel ?? "manual",
              note: input.evidenceNote ?? null,
              createdByUserId: ctx.actorUserId,
            },
          }
        : undefined,
    },
  });

  await writeAuditLog({
    ctx: {
      ...ctx,
      organizationId: created.organizationId ?? undefined,
      clinicId: created.clinicId ?? undefined,
    },
    action: "CREATE",
    entityType: "PayerRule",
    entityId: created.id,
    organizationId: created.organizationId,
    clinicId: created.clinicId,
    metadata: {
      payerName: created.payerName,
      category: created.ruleCategory,
      sourceType: created.sourceType,
      isActive: created.isActive,
    },
  });

  logger.info("Payer rule created", {
    payerRuleId: created.id,
    organizationId: created.organizationId,
    clinicId: created.clinicId,
  });

  return created;
}

export async function updatePayerRule(
  ctx: ServiceContext,
  ruleId: string,
  input: {
    title?: string;
    description?: string;
    ruleCategory?: PayerRuleCategory;
    clinicId?: string | null;
    medicationCatalogItemId?: string | null;
    stateCode?: string | null;
    serviceContext?: string | null;
    expectedReimbursementAmount?: number | null;
    expectedReimbursementMin?: number | null;
    expectedReimbursementMax?: number | null;
    confidenceLevel?: PayerRuleConfidenceLevel;
    sourceType?: PayerRuleSourceType;
    isActive?: boolean;
    effectiveDate?: Date | null;
    endDate?: Date | null;
  },
) {
  const existing = await prisma.payerRule.findUnique({
    where: { id: ruleId },
    select: { id: true, organizationId: true, clinicId: true },
  });
  if (!existing) throw new AppError("Payer rule not found", "NOT_FOUND", 404);

  await ensureManageScope(ctx, { organizationId: existing.organizationId ?? undefined, clinicId: existing.clinicId ?? undefined });

  const updated = await prisma.payerRule.update({
    where: { id: existing.id },
    data: {
      title: input.title,
      description: input.description,
      ruleCategory: input.ruleCategory,
      clinicId: input.clinicId,
      medicationCatalogItemId: input.medicationCatalogItemId,
      stateCode: input.stateCode,
      serviceContext: input.serviceContext,
      expectedReimbursementAmount:
        input.expectedReimbursementAmount === undefined
          ? undefined
          : input.expectedReimbursementAmount === null
            ? null
            : new Prisma.Decimal(input.expectedReimbursementAmount),
      expectedReimbursementMin:
        input.expectedReimbursementMin === undefined
          ? undefined
          : input.expectedReimbursementMin === null
            ? null
            : new Prisma.Decimal(input.expectedReimbursementMin),
      expectedReimbursementMax:
        input.expectedReimbursementMax === undefined
          ? undefined
          : input.expectedReimbursementMax === null
            ? null
            : new Prisma.Decimal(input.expectedReimbursementMax),
      confidenceLevel: input.confidenceLevel,
      sourceType: input.sourceType,
      isActive: input.isActive,
      effectiveDate: input.effectiveDate,
      endDate: input.endDate,
    },
  });

  await writeAuditLog({
    ctx: {
      ...ctx,
      organizationId: updated.organizationId ?? undefined,
      clinicId: updated.clinicId ?? undefined,
    },
    action: "UPDATE",
    entityType: "PayerRule",
    entityId: updated.id,
    organizationId: updated.organizationId,
    clinicId: updated.clinicId,
    metadata: { isActive: updated.isActive },
  });
  logger.info("Payer rule updated", { payerRuleId: updated.id });

  return updated;
}

function scoreRuleMatch(
  rule: {
    medicationCatalogItemId: string | null;
    clinicId: string | null;
    stateCode: string | null;
    serviceContext: string | null;
  },
  input: {
    medicationCatalogItemId?: string;
    clinicId?: string;
    stateCode?: string;
    serviceContext?: string;
  },
) {
  let score = 100; // payer exact match required in query

  if (input.medicationCatalogItemId) {
    score += rule.medicationCatalogItemId === input.medicationCatalogItemId ? 30 : rule.medicationCatalogItemId ? -50 : 0;
  }
  if (input.clinicId) {
    score += rule.clinicId === input.clinicId ? 20 : rule.clinicId ? -20 : 0;
  }
  if (input.stateCode) {
    score += rule.stateCode?.toUpperCase() === input.stateCode.toUpperCase() ? 12 : rule.stateCode ? -10 : 0;
  }
  if (input.serviceContext) {
    score +=
      rule.serviceContext?.toLowerCase() === input.serviceContext.toLowerCase()
        ? 8
        : rule.serviceContext
          ? -6
          : 0;
  }
  return score;
}

export async function getMatchingPayerRules(
  ctx: ServiceContext,
  input: {
    organizationId?: string;
    clinicId?: string;
    payerName: string;
    medicationCatalogItemId?: string;
    stateCode?: string;
    serviceContext?: string;
    includeInactive?: boolean;
    limit?: number;
  },
) {
  await ensureReadScope(ctx, { organizationId: input.organizationId, clinicId: input.clinicId });

  const now = new Date();
  const andFilters: Prisma.PayerRuleWhereInput[] = [
    {
      OR: [{ effectiveDate: null }, { effectiveDate: { lte: now } }],
    },
    {
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
  ];
  const where: Prisma.PayerRuleWhereInput = {
    payerName: { equals: input.payerName, mode: "insensitive" },
    isActive: input.includeInactive ? undefined : true,
    AND: andFilters,
  };

  if (input.organizationId) {
    andFilters.push({ OR: [{ organizationId: input.organizationId }, { organizationId: null }] });
  }
  if (input.clinicId) {
    andFilters.push({ OR: [{ clinicId: input.clinicId }, { clinicId: null }] });
  }

  const rules = await prisma.payerRule.findMany({
    where,
    include: {
      medicationCatalogItem: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
      evidence: { select: { id: true } },
    },
    take: Math.min(input.limit ?? 25, 100),
  });

  const ranked = rules
    .map((rule) => ({
      ...rule,
      matchScore: scoreRuleMatch(rule, input),
    }))
    .sort((a, b) => b.matchScore - a.matchScore);

  return ranked;
}

export async function getExpectedReimbursementGuidance(
  ctx: ServiceContext,
  input: {
    organizationId?: string;
    clinicId?: string;
    payerName: string;
    medicationCatalogItemId?: string;
    stateCode?: string;
    serviceContext?: string;
  },
) {
  const matches = await getMatchingPayerRules(ctx, {
    ...input,
    includeInactive: false,
    limit: 25,
  });

  const reimbursementRules = matches.filter((r) => r.ruleCategory === "REIMBURSEMENT");
  const best = reimbursementRules[0] ?? null;
  if (!best) {
    return {
      matched: false,
      recommendation: null,
      sourceRuleId: null,
      evidenceCount: 0,
    };
  }

  return {
    matched: true,
    recommendation: {
      expectedAmount: decimalToNumber(best.expectedReimbursementAmount),
      minAmount: decimalToNumber(best.expectedReimbursementMin),
      maxAmount: decimalToNumber(best.expectedReimbursementMax),
      confidenceLevel: best.confidenceLevel,
      title: best.title,
      description: best.description,
    },
    sourceRuleId: best.id,
    evidenceCount: 0,
  };
}

export async function listPayerRuleSuggestions(
  ctx: ServiceContext,
  input?: {
    organizationId?: string;
    status?: PayerRuleSuggestionStatus;
    limit?: number;
  },
) {
  await ensureReadScope(ctx, { organizationId: input?.organizationId });

  return prisma.payerRuleSuggestion.findMany({
    where: {
      organizationId: input?.organizationId,
      status: input?.status,
    },
    include: {
      sourceDocument: { select: { id: true, title: true, createdAt: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: input?.limit ?? 100,
  });
}

export async function approveSuggestion(
  ctx: ServiceContext,
  suggestionId: string,
  input?: {
    activate?: boolean;
    confidenceLevel?: PayerRuleConfidenceLevel;
    effectiveDate?: Date;
    endDate?: Date;
  },
) {
  const suggestion = await prisma.payerRuleSuggestion.findUnique({
    where: { id: suggestionId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      suggestedRuleJSON: true,
      sourceDocumentId: true,
    },
  });
  if (!suggestion) throw new AppError("Payer rule suggestion not found", "NOT_FOUND", 404);
  if (suggestion.status !== "DRAFT") {
    throw new AppError("Only draft suggestions can be approved", "VALIDATION_ERROR", 400);
  }

  await ensureManageScope(ctx, { organizationId: suggestion.organizationId });

  const payload = suggestion.suggestedRuleJSON as Record<string, unknown>;
  const payerName = typeof payload.payerName === "string" ? payload.payerName : "";
  const title = typeof payload.title === "string" ? payload.title : "";
  const ruleCategory = (payload.ruleCategory as PayerRuleCategory | undefined) ?? "REIMBURSEMENT";
  if (!payerName || !title) {
    throw new AppError("Suggestion is missing required payer rule fields", "VALIDATION_ERROR", 400);
  }

  const createdRule = await createPayerRule(ctx, {
    organizationId: suggestion.organizationId,
    payerName,
    ruleCategory,
    title,
    description: typeof payload.description === "string" ? payload.description : undefined,
    serviceContext: typeof payload.serviceContext === "string" ? payload.serviceContext : undefined,
    stateCode: typeof payload.stateCode === "string" ? payload.stateCode : undefined,
    expectedReimbursementAmount:
      typeof payload.expectedReimbursementAmount === "number" ? payload.expectedReimbursementAmount : undefined,
    expectedReimbursementMin:
      typeof payload.expectedReimbursementMin === "number" ? payload.expectedReimbursementMin : undefined,
    expectedReimbursementMax:
      typeof payload.expectedReimbursementMax === "number" ? payload.expectedReimbursementMax : undefined,
    confidenceLevel: input?.confidenceLevel ?? "MEDIUM",
    sourceType: "AI_SUGGESTED",
    isActive: input?.activate ?? true,
    effectiveDate: input?.effectiveDate,
    endDate: input?.endDate,
    evidenceDocumentId: suggestion.sourceDocumentId ?? undefined,
    evidenceSourceLabel: "ai-extraction",
    evidenceNote: `Approved from suggestion ${suggestion.id}`,
  });

  await prisma.payerRuleSuggestion.update({
    where: { id: suggestion.id },
    data: { status: "APPROVED" },
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: suggestion.organizationId },
    action: "UPDATE",
    entityType: "PayerRuleSuggestion",
    entityId: suggestion.id,
    organizationId: suggestion.organizationId,
    clinicId: null,
    metadata: { status: "APPROVED", payerRuleId: createdRule.id },
  });
  logger.info("Payer rule suggestion approved", { suggestionId: suggestion.id, payerRuleId: createdRule.id });

  return { suggestionId: suggestion.id, payerRuleId: createdRule.id };
}

export async function rejectSuggestion(ctx: ServiceContext, suggestionId: string, input?: { note?: string }) {
  const suggestion = await prisma.payerRuleSuggestion.findUnique({
    where: { id: suggestionId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!suggestion) throw new AppError("Payer rule suggestion not found", "NOT_FOUND", 404);
  if (suggestion.status !== "DRAFT") {
    throw new AppError("Only draft suggestions can be rejected", "VALIDATION_ERROR", 400);
  }

  await ensureManageScope(ctx, { organizationId: suggestion.organizationId });

  const updated = await prisma.payerRuleSuggestion.update({
    where: { id: suggestion.id },
    data: { status: "REJECTED" },
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: suggestion.organizationId },
    action: "UPDATE",
    entityType: "PayerRuleSuggestion",
    entityId: suggestion.id,
    organizationId: suggestion.organizationId,
    clinicId: null,
    metadata: { status: "REJECTED", note: input?.note ?? null },
  });
  logger.info("Payer rule suggestion rejected", { suggestionId: suggestion.id });

  return updated;
}
