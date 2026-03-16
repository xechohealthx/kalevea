import { z } from "zod";

import {
  PayerRuleCategories,
  PayerRuleConfidenceLevels,
  PayerRuleSourceTypes,
  PayerRuleSuggestionStatuses,
} from "./payer-rule.types";

const ruleCategoryEnum = z.enum(PayerRuleCategories);
const confidenceEnum = z.enum(PayerRuleConfidenceLevels);
const sourceTypeEnum = z.enum(PayerRuleSourceTypes);
const suggestionStatusEnum = z.enum(PayerRuleSuggestionStatuses);

export const listPayerRulesSchema = z.object({
  organizationId: z.string().min(1).optional(),
  clinicId: z.string().min(1).optional(),
  payerName: z.string().trim().min(1).optional(),
  category: ruleCategoryEnum.optional(),
  isActive: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const createPayerRuleSchema = z.object({
  organizationId: z.string().min(1).optional(),
  clinicId: z.string().min(1).optional(),
  payerName: z.string().trim().min(2).max(120),
  ruleCategory: ruleCategoryEnum,
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  medicationCatalogItemId: z.string().min(1).optional(),
  stateCode: z.string().trim().length(2).toUpperCase().optional(),
  serviceContext: z.string().trim().max(120).optional(),
  expectedReimbursementAmount: z.coerce.number().positive().max(1_000_000).optional(),
  expectedReimbursementMin: z.coerce.number().positive().max(1_000_000).optional(),
  expectedReimbursementMax: z.coerce.number().positive().max(1_000_000).optional(),
  confidenceLevel: confidenceEnum.default("MEDIUM"),
  sourceType: sourceTypeEnum.default("MANUAL"),
  isActive: z.boolean().default(true),
  effectiveDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  evidenceDocumentId: z.string().min(1).optional(),
  evidenceSourceLabel: z.string().trim().max(120).optional(),
  evidenceNote: z.string().trim().max(1000).optional(),
});

export const updatePayerRuleSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(2000).optional(),
  ruleCategory: ruleCategoryEnum.optional(),
  clinicId: z.string().min(1).nullable().optional(),
  medicationCatalogItemId: z.string().min(1).nullable().optional(),
  stateCode: z.string().trim().length(2).toUpperCase().nullable().optional(),
  serviceContext: z.string().trim().max(120).nullable().optional(),
  expectedReimbursementAmount: z.coerce.number().positive().max(1_000_000).nullable().optional(),
  expectedReimbursementMin: z.coerce.number().positive().max(1_000_000).nullable().optional(),
  expectedReimbursementMax: z.coerce.number().positive().max(1_000_000).nullable().optional(),
  confidenceLevel: confidenceEnum.optional(),
  sourceType: sourceTypeEnum.optional(),
  isActive: z.boolean().optional(),
  effectiveDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

export const listPayerRuleSuggestionsSchema = z.object({
  organizationId: z.string().min(1).optional(),
  status: suggestionStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const extractPayerRuleCandidatesSchema = z.object({
  organizationId: z.string().min(1),
  documentId: z.string().min(1),
  payerName: z.string().trim().min(2).max(120).optional(),
  model: z.string().trim().min(1).max(120).optional(),
});

export const approvePayerRuleSuggestionSchema = z.object({
  activate: z.boolean().default(true),
  confidenceLevel: confidenceEnum.optional(),
  effectiveDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const rejectPayerRuleSuggestionSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
