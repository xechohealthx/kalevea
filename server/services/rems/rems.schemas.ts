import { z } from "zod";

export const upsertEnrollmentSchema = z.object({
  remsProgramId: z.string().min(1),
  status: z.enum(["NOT_ENROLLED", "PENDING", "ENROLLED", "SUSPENDED", "EXPIRED"]),
  enrolledAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  lastReviewedAt: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const createAttestationSchema = z.object({
  remsProgramId: z.string().min(1),
  clinicId: z.string().min(1),
  providerId: z.string().nullable().optional(),
  remsRequirementId: z.string().nullable().optional(),
  title: z.string().min(2),
  notes: z.string().nullable().optional(),
  attestedAt: z.string().datetime().nullable().optional(),
});

