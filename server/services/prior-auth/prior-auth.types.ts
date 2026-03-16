export const PriorAuthParentTypes = {
  case: "PRIOR_AUTH_CASE",
} as const;

export const PriorAuthStatuses = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_PAYER",
  "APPROVED",
  "DENIED",
  "CANCELLED",
] as const;

export type PriorAuthStatus = (typeof PriorAuthStatuses)[number];
