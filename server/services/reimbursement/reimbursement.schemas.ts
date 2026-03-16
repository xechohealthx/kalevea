import { z } from "zod";

import { ClaimStatuses, PaymentSourceTypes, ReimbursementStatuses } from "./reimbursement.types";

const reimbursementStatusEnum = z.enum(ReimbursementStatuses);
const claimStatusEnum = z.enum(ClaimStatuses);
const paymentSourceTypeEnum = z.enum(PaymentSourceTypes);

export const listReimbursementCasesSchema = z.object({
  clinicId: z.string().min(1).optional(),
  status: reimbursementStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const createReimbursementCaseSchema = z.object({
  clinicId: z.string().min(1),
  buyAndBillCaseId: z.string().min(1).optional(),
  priorAuthorizationCaseId: z.string().min(1).optional(),
  patientReferenceId: z.string().trim().min(1).max(120).optional(),
  payerName: z.string().trim().min(2).max(120),
  expectedAmount: z.coerce.number().positive().max(1_000_000),
  expectedAllowedAmount: z.coerce.number().positive().max(1_000_000).optional(),
  initialNote: z.string().trim().max(500).optional(),
  documentIds: z.array(z.string().min(1)).max(20).optional(),
});

export const updateReimbursementStatusSchema = z.object({
  status: reimbursementStatusEnum,
  note: z.string().trim().max(500).optional(),
  documentIds: z.array(z.string().min(1)).max(20).optional(),
});

export const createClaimRecordSchema = z.object({
  externalClaimId: z.string().trim().max(120).optional(),
  claimNumber: z.string().trim().max(120).optional(),
  payerName: z.string().trim().min(2).max(120),
  submittedAt: z.string().datetime().optional(),
  status: claimStatusEnum.default("DRAFT"),
  billedAmount: z.coerce.number().positive().max(1_000_000).optional(),
  notes: z.string().trim().max(500).optional(),
  documentIds: z.array(z.string().min(1)).max(20).optional(),
});

export const updateClaimRecordStatusSchema = z.object({
  status: claimStatusEnum,
  note: z.string().trim().max(500).optional(),
});

export const createPaymentRecordSchema = z.object({
  claimRecordId: z.string().min(1).optional(),
  paidAmount: z.coerce.number().positive().max(1_000_000),
  paidDate: z.string().datetime(),
  sourceType: paymentSourceTypeEnum.default("MANUAL"),
  referenceNumber: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  documentIds: z.array(z.string().min(1)).max(20).optional(),
});
