/**
 * Kalevea RBAC v2: Permissions
 *
 * Use permissions for new modules instead of checking role names directly.
 * Roles remain the source of truth for *who* has access, but permissions are the
 * stable contract for *what* they can do.
 *
 * Future engines (REMS, PA, Buy & Bill, Claims, Inventory) should:
 * - define permissions in this file (or a module-specific grouped section)
 * - enforce them in services via `requirePermission(...)`
 * - avoid branching on role keys (role names can evolve, permissions should not)
 */

export const Permissions = {
  clinics: {
    read: "clinics.read",
    manage: "clinics.manage",
  },
  providers: {
    read: "providers.read",
    manage: "providers.manage",
  },
  onboarding: {
    read: "onboarding.read",
    manage: "onboarding.manage",
  },
  support: {
    read: "support.read",
    manage: "support.manage",
  },
  training: {
    read: "training.read",
    manage: "training.manage",
  },
  documents: {
    read: "documents.read",
    manage: "documents.manage",
  },
  rems: {
    read: "rems.read",
    manage: "rems.manage",
    attest: "rems.attest",
  },
  priorAuth: {
    read: "priorAuth.read",
    manage: "priorAuth.manage",
  },
  buyAndBill: {
    read: "buyAndBill.read",
    manage: "buyAndBill.manage",
  },
  inventory: {
    read: "inventory.read",
    manage: "inventory.manage",
  },
  reimbursement: {
    read: "reimbursement.read",
    manage: "reimbursement.manage",
  },
  claims: {
    read: "claims.read",
    manage: "claims.manage",
  },
  era: {
    read: "era.read",
    manage: "era.manage",
  },
  analytics: {
    read: "analytics.read",
    manage: "analytics.manage",
  },
  benchmarking: {
    read: "benchmarking.read",
    manage: "benchmarking.manage",
  },
  commandCenter: {
    read: "commandCenter.read",
    manage: "commandCenter.manage",
  },
  automation: {
    read: "automation.read",
    manage: "automation.manage",
  },
  revenue: {
    read: "revenue.read",
    manage: "revenue.manage",
  },
  aiAssistant: {
    read: "aiAssistant.read",
  },
  payerRules: {
    read: "payerRules.read",
    manage: "payerRules.manage",
  },
  identity: {
    read: "identity.read",
    manage: "identity.manage",
  },
} as const;

export type Permission =
  | (typeof Permissions)["clinics"][keyof (typeof Permissions)["clinics"]]
  | (typeof Permissions)["providers"][keyof (typeof Permissions)["providers"]]
  | (typeof Permissions)["onboarding"][keyof (typeof Permissions)["onboarding"]]
  | (typeof Permissions)["support"][keyof (typeof Permissions)["support"]]
  | (typeof Permissions)["training"][keyof (typeof Permissions)["training"]]
  | (typeof Permissions)["documents"][keyof (typeof Permissions)["documents"]]
  | (typeof Permissions)["rems"][keyof (typeof Permissions)["rems"]]
  | (typeof Permissions)["priorAuth"][keyof (typeof Permissions)["priorAuth"]]
  | (typeof Permissions)["buyAndBill"][keyof (typeof Permissions)["buyAndBill"]]
  | (typeof Permissions)["inventory"][keyof (typeof Permissions)["inventory"]]
  | (typeof Permissions)["reimbursement"][keyof (typeof Permissions)["reimbursement"]]
  | (typeof Permissions)["claims"][keyof (typeof Permissions)["claims"]]
  | (typeof Permissions)["era"][keyof (typeof Permissions)["era"]]
  | (typeof Permissions)["analytics"][keyof (typeof Permissions)["analytics"]]
  | (typeof Permissions)["benchmarking"][keyof (typeof Permissions)["benchmarking"]]
  | (typeof Permissions)["commandCenter"][keyof (typeof Permissions)["commandCenter"]]
  | (typeof Permissions)["automation"][keyof (typeof Permissions)["automation"]]
  | (typeof Permissions)["revenue"][keyof (typeof Permissions)["revenue"]]
  | (typeof Permissions)["aiAssistant"][keyof (typeof Permissions)["aiAssistant"]]
  | (typeof Permissions)["payerRules"][keyof (typeof Permissions)["payerRules"]]
  | (typeof Permissions)["identity"][keyof (typeof Permissions)["identity"]];

export type PermissionScope = "GLOBAL" | "ORGANIZATION" | "CLINIC";

