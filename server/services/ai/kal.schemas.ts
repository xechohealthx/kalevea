import { z } from "zod";

export const kalIntentSchema = z.enum([
  "general",
  "reimbursement",
  "operations",
  "benchmarking",
  "onboarding",
  "prior_auth",
  "revenue",
  "predictive",
]);

export const kalQuerySchema = z.object({
  query: z.string().trim().min(3).max(2000),
  organizationId: z.string().min(1).optional(),
  clinicId: z.string().min(1).optional(),
  intent: kalIntentSchema.default("general"),
  includeContext: z.boolean().optional().default(false),
});

export const kalContextSchema = z.object({
  organizationId: z.string().min(1).optional(),
  clinicId: z.string().min(1).optional(),
  intent: kalIntentSchema.default("general"),
  query: z.string().trim().max(2000).optional(),
});

export const kalExplainTargetSchema = z.enum([
  "dashboard",
  "clinic_performance",
  "reimbursement_variance",
  "underpayment_signal",
]);

export const kalExplainSchema = z.object({
  organizationId: z.string().min(1).optional(),
  clinicId: z.string().min(1).optional(),
  target: kalExplainTargetSchema.default("dashboard"),
  signalId: z.string().min(1).optional(),
  query: z.string().trim().max(2000).optional(),
});

export const kalInsightsSchema = z.object({
  organizationId: z.string().min(1).optional(),
  clinicId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(20).default(6),
});

export const kalOnboardingAnalysisSchema = z.object({
  organizationId: z.string().min(1).optional(),
  clinicId: z.string().min(1).optional(),
});

export const kalRecommendationsSchema = z.object({
  organizationId: z.string().min(1).optional(),
  clinicId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(20).default(8),
});

export const kalActionSchema = z.object({
  title: z.string().min(1).max(200),
  reason: z.string().min(1).max(1200),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  actionType: z.enum(["createTask", "createOperationalAlert", "notifyUser", "reviewOnly"]),
  targetEntityType: z.string().max(80).nullable().optional(),
  targetEntityId: z.string().max(80).nullable().optional(),
  requiresHumanConfirmation: z.literal(true),
});

export const kalAnswerSchema = z.object({
  summary: z.string().min(1).max(3000),
  keyFindings: z.array(z.string().min(1).max(1000)).max(8),
  recommendedActions: z.array(kalActionSchema).max(8),
  followUpQuestions: z.array(z.string().min(1).max(300)).max(6),
  toolsUsed: z.array(z.string().min(1).max(80)).max(20),
});

export type KalIntent = z.infer<typeof kalIntentSchema>;
export type KalAnswer = z.infer<typeof kalAnswerSchema>;
export type KalExplainTarget = z.infer<typeof kalExplainTargetSchema>;
