export const GlobalRoles = ["SUPER_ADMIN", "MSO_EXECUTIVE"] as const;

export const OrganizationRoles = [
  "ORG_ADMIN",
  "IMPLEMENTATION_MANAGER",
  "PA_SPECIALIST",
  "BILLING_SPECIALIST",
  "COMPLIANCE_SPECIALIST",
  "SUPPORT_SPECIALIST",
  "ANALYST",
] as const;

export const ClinicRoles = [
  "CLINIC_ADMIN",
  "PROVIDER",
  "BILLING_CONTACT",
  "OPERATIONS_CONTACT",
  "READ_ONLY",
] as const;

export type GlobalRoleKey = (typeof GlobalRoles)[number];
export type OrganizationRoleKey = (typeof OrganizationRoles)[number];
export type ClinicRoleKey = (typeof ClinicRoles)[number];

export type AnyRoleKey = GlobalRoleKey | OrganizationRoleKey | ClinicRoleKey;

