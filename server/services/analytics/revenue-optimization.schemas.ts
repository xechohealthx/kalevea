import { z } from "zod";

export const revenueSignalTypeSchema = z.enum([
  "APPEAL_OPPORTUNITY",
  "HIGH_VARIANCE_RISK",
  "PAYER_PATTERN_ALERT",
  "FORECAST_RISK",
]);

export const revenueSignalSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const listRevenueSignalsSchema = z.object({
  organizationId: z.string().min(1).optional(),
  clinicId: z.string().min(1).optional(),
  signalType: revenueSignalTypeSchema.optional(),
  signalSeverity: revenueSignalSeveritySchema.optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  refresh: z.coerce.boolean().optional(),
});

export const forecastRevenueSchema = z.object({
  organizationId: z.string().min(1).optional(),
  clinicId: z.string().min(1).optional(),
  payerName: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const revenueOpportunitiesSchema = z.object({
  organizationId: z.string().min(1).optional(),
  clinicId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
