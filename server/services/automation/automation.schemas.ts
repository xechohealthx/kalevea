import { z } from "zod";

import { AutomationActionTypes, AutomationRuleTypes } from "./automation.types";

const automationRuleTypeEnum = z.enum(AutomationRuleTypes);
const automationActionTypeEnum = z.enum(AutomationActionTypes);

export const listAutomationRulesSchema = z.object({
  organizationId: z.string().min(1),
  isActive: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const createAutomationRuleSchema = z.object({
  organizationId: z.string().min(1),
  ruleType: automationRuleTypeEnum,
  conditionConfig: z.object({
    threshold: z.coerce.number().optional(),
    daysStuck: z.coerce.number().int().positive().optional(),
    daysDelay: z.coerce.number().int().positive().optional(),
    lookbackDays: z.coerce.number().int().positive().optional(),
    clinicId: z.string().min(1).optional(),
    payerName: z.string().trim().min(1).optional(),
  }).passthrough().default({}),
  actionConfig: z.object({
    actionType: automationActionTypeEnum,
    title: z.string().trim().max(200).optional(),
    message: z.string().trim().max(500).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    assignedToId: z.string().min(1).optional(),
  }).passthrough(),
  isActive: z.boolean().default(true),
});

export const updateAutomationRuleSchema = z.object({
  conditionConfig: z.record(z.string(), z.unknown()).optional(),
  actionConfig: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const runAutomationSchema = z.object({
  organizationId: z.string().min(1),
  ruleId: z.string().min(1).optional(),
});
