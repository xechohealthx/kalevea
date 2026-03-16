export const BuyAndBillParentTypes = {
  case: "BUY_AND_BILL_CASE",
  lot: "MEDICATION_LOT",
  administration: "MEDICATION_ADMINISTRATION",
} as const;

export const BuyAndBillStatuses = [
  "DRAFT",
  "READY_FOR_ADMINISTRATION",
  "ADMINISTERED",
  "BILLING_PENDING",
  "SUBMITTED",
  "PAID",
  "DENIED",
  "CANCELLED",
] as const;

export type BuyAndBillStatus = (typeof BuyAndBillStatuses)[number];
