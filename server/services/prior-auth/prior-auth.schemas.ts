import { z } from "zod";

import { PriorAuthStatuses } from "./prior-auth.types";

const statusEnum = z.enum(PriorAuthStatuses);

export const createPACaseSchema = z.object({
  clinicId: z.string().min(1),
  payerName: z.string().trim().min(2).max(120),
  medicationName: z.string().trim().min(2).max(120),
  patientReferenceId: z.string().trim().min(1).max(120).optional(),
  documentIds: z.array(z.string().min(1)).max(20).optional(),
  initialNote: z.string().trim().max(500).optional(),
});

export const updatePAStatusSchema = z.object({
  status: statusEnum,
  note: z.string().trim().max(500).optional(),
  documentIds: z.array(z.string().min(1)).max(20).optional(),
});

export const listPACasesSchema = z.object({
  clinicId: z.string().min(1).optional(),
  status: statusEnum.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
