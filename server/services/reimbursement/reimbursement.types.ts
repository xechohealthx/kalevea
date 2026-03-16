export const ReimbursementParentTypes = {
  case: "REIMBURSEMENT_CASE",
  claim: "REIMBURSEMENT_CLAIM",
  payment: "REIMBURSEMENT_PAYMENT",
} as const;

export const ReimbursementStatuses = [
  "EXPECTED",
  "CLAIM_DRAFT",
  "SUBMITTED",
  "PENDING_PAYMENT",
  "PARTIALLY_PAID",
  "PAID",
  "DENIED",
  "APPEAL_NEEDED",
  "CLOSED",
] as const;

export const ClaimStatuses = [
  "DRAFT",
  "SUBMITTED",
  "ACCEPTED",
  "REJECTED",
  "PENDING",
  "PAID",
  "DENIED",
] as const;

export const PaymentSourceTypes = ["MANUAL", "ERA_IMPORTED", "OTHER"] as const;

export type ReimbursementStatus = (typeof ReimbursementStatuses)[number];
export type ClaimStatus = (typeof ClaimStatuses)[number];
