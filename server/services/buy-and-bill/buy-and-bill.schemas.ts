import { z } from "zod";

import { BuyAndBillStatuses } from "./buy-and-bill.types";

const statusEnum = z.enum(BuyAndBillStatuses);

export const listBuyAndBillCasesSchema = z.object({
  clinicId: z.string().min(1).optional(),
  status: statusEnum.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const createBuyAndBillCaseSchema = z.object({
  clinicId: z.string().min(1),
  patientReferenceId: z.string().trim().min(1).max(120).optional(),
  medicationCatalogItemId: z.string().min(1),
  priorAuthorizationCaseId: z.string().min(1).optional(),
  expectedReimbursementAmount: z.coerce.number().positive().max(1_000_000).optional(),
  expectedPayerName: z.string().trim().min(2).max(120).optional(),
  documentIds: z.array(z.string().min(1)).max(20).optional(),
  initialNote: z.string().trim().max(500).optional(),
});

export const updateBuyAndBillStatusSchema = z.object({
  status: statusEnum,
  note: z.string().trim().max(500).optional(),
  documentIds: z.array(z.string().min(1)).max(20).optional(),
});

export const listMedicationLotsSchema = z.object({
  clinicId: z.string().min(1).optional(),
  medicationCatalogItemId: z.string().min(1).optional(),
  includeDepleted: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const createMedicationLotSchema = z.object({
  clinicId: z.string().min(1),
  medicationCatalogItemId: z.string().min(1),
  lotNumber: z.string().trim().min(1).max(120),
  expirationDate: z.string().datetime(),
  quantityReceived: z.coerce.number().int().positive().max(1_000_000),
  acquisitionDate: z.string().datetime(),
  supplierName: z.string().trim().max(200).optional(),
  invoiceReference: z.string().trim().max(120).optional(),
  documentIds: z.array(z.string().min(1)).max(20).optional(),
});

export const recordMedicationAdministrationSchema = z.object({
  medicationLotId: z.string().min(1),
  administeredAt: z.string().datetime(),
  unitsAdministered: z.coerce.number().int().positive().max(1_000_000),
  notes: z.string().trim().max(500).optional(),
  documentIds: z.array(z.string().min(1)).max(20).optional(),
});
