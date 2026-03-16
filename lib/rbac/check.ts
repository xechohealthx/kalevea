import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import type { AnyRoleKey } from "@/lib/rbac/roles";
import { Permissions, type Permission, type PermissionScope } from "@/lib/rbac/permissions";

type ScopeInput =
  | { scope: "GLOBAL" }
  | { scope: "ORGANIZATION"; organizationId: string }
  | { scope: "CLINIC"; clinicId: string };

const ALL_PERMISSIONS: Permission[] = [
  Permissions.clinics.read,
  Permissions.clinics.manage,
  Permissions.providers.read,
  Permissions.providers.manage,
  Permissions.onboarding.read,
  Permissions.onboarding.manage,
  Permissions.support.read,
  Permissions.support.manage,
  Permissions.training.read,
  Permissions.training.manage,
  Permissions.documents.read,
  Permissions.documents.manage,
  Permissions.rems.read,
  Permissions.rems.manage,
  Permissions.rems.attest,
  Permissions.priorAuth.read,
  Permissions.priorAuth.manage,
  Permissions.buyAndBill.read,
  Permissions.buyAndBill.manage,
  Permissions.inventory.read,
  Permissions.inventory.manage,
  Permissions.reimbursement.read,
  Permissions.reimbursement.manage,
  Permissions.claims.read,
  Permissions.claims.manage,
  Permissions.era.read,
  Permissions.era.manage,
  Permissions.analytics.read,
  Permissions.analytics.manage,
  Permissions.benchmarking.read,
  Permissions.benchmarking.manage,
  Permissions.commandCenter.read,
  Permissions.commandCenter.manage,
  Permissions.automation.read,
  Permissions.automation.manage,
  Permissions.revenue.read,
  Permissions.revenue.manage,
  Permissions.aiAssistant.read,
  Permissions.payerRules.read,
  Permissions.payerRules.manage,
  Permissions.identity.read,
  Permissions.identity.manage,
];

const rolePermissions: Record<AnyRoleKey, Permission[]> = {
  // GLOBAL
  SUPER_ADMIN: ALL_PERMISSIONS,
  MSO_EXECUTIVE: [
    Permissions.clinics.read,
    Permissions.providers.read,
    Permissions.onboarding.read,
    Permissions.support.read,
    Permissions.training.read,
    Permissions.documents.read,
    Permissions.rems.read,
    Permissions.priorAuth.read,
    Permissions.buyAndBill.read,
    Permissions.inventory.read,
    Permissions.reimbursement.read,
    Permissions.claims.read,
    Permissions.era.read,
    Permissions.analytics.read,
    Permissions.benchmarking.read,
    Permissions.commandCenter.read,
    Permissions.automation.read,
    Permissions.revenue.read,
    Permissions.aiAssistant.read,
    Permissions.payerRules.read,
    Permissions.identity.read,
  ],

  // ORGANIZATION
  ORG_ADMIN: ALL_PERMISSIONS,
  IMPLEMENTATION_MANAGER: [
    Permissions.clinics.read,
    Permissions.clinics.manage,
    Permissions.onboarding.read,
    Permissions.onboarding.manage,
    Permissions.providers.read,
    Permissions.support.read,
    Permissions.training.read,
    Permissions.documents.read,
    Permissions.rems.read,
    Permissions.rems.manage,
    Permissions.rems.attest,
    Permissions.priorAuth.read,
    Permissions.priorAuth.manage,
    Permissions.buyAndBill.read,
    Permissions.buyAndBill.manage,
    Permissions.inventory.read,
    Permissions.inventory.manage,
    Permissions.reimbursement.read,
    Permissions.reimbursement.manage,
    Permissions.claims.read,
    Permissions.claims.manage,
    Permissions.era.read,
    Permissions.era.manage,
    Permissions.analytics.read,
    Permissions.analytics.manage,
    Permissions.benchmarking.read,
    Permissions.benchmarking.manage,
    Permissions.commandCenter.read,
    Permissions.commandCenter.manage,
    Permissions.automation.read,
    Permissions.automation.manage,
    Permissions.revenue.read,
    Permissions.revenue.manage,
    Permissions.aiAssistant.read,
    Permissions.payerRules.read,
    Permissions.payerRules.manage,
    Permissions.identity.read,
    Permissions.identity.manage,
  ],
  PA_SPECIALIST: [
    Permissions.clinics.read,
    Permissions.onboarding.read,
    Permissions.support.read,
    Permissions.documents.read,
    Permissions.priorAuth.read,
    Permissions.priorAuth.manage,
    Permissions.buyAndBill.read,
    Permissions.reimbursement.read,
    Permissions.claims.read,
    Permissions.era.read,
    Permissions.analytics.read,
    Permissions.benchmarking.read,
    Permissions.commandCenter.read,
    Permissions.automation.read,
    Permissions.revenue.read,
    Permissions.aiAssistant.read,
    Permissions.payerRules.read,
  ],
  BILLING_SPECIALIST: [
    Permissions.clinics.read,
    Permissions.providers.read,
    Permissions.support.read,
    Permissions.documents.read,
    Permissions.training.read,
    Permissions.priorAuth.read,
    Permissions.buyAndBill.read,
    Permissions.buyAndBill.manage,
    Permissions.inventory.read,
    Permissions.reimbursement.read,
    Permissions.reimbursement.manage,
    Permissions.claims.read,
    Permissions.claims.manage,
    Permissions.era.read,
    Permissions.era.manage,
    Permissions.analytics.read,
    Permissions.analytics.manage,
    Permissions.benchmarking.read,
    Permissions.benchmarking.manage,
    Permissions.commandCenter.read,
    Permissions.commandCenter.manage,
    Permissions.automation.read,
    Permissions.automation.manage,
    Permissions.revenue.read,
    Permissions.revenue.manage,
    Permissions.aiAssistant.read,
    Permissions.payerRules.read,
    Permissions.payerRules.manage,
  ],
  COMPLIANCE_SPECIALIST: [
    Permissions.clinics.read,
    Permissions.providers.read,
    Permissions.documents.read,
    Permissions.training.read,
    Permissions.support.read,
    Permissions.rems.read,
    Permissions.rems.manage,
    Permissions.rems.attest,
    Permissions.priorAuth.read,
    Permissions.buyAndBill.read,
    Permissions.inventory.read,
    Permissions.reimbursement.read,
    Permissions.claims.read,
    Permissions.era.read,
    Permissions.analytics.read,
    Permissions.benchmarking.read,
    Permissions.commandCenter.read,
    Permissions.automation.read,
    Permissions.revenue.read,
    Permissions.aiAssistant.read,
    Permissions.payerRules.read,
    Permissions.identity.read,
  ],
  SUPPORT_SPECIALIST: [
    Permissions.support.read,
    Permissions.support.manage,
    Permissions.clinics.read,
    Permissions.providers.read,
    Permissions.onboarding.read,
    Permissions.training.read,
    Permissions.documents.read,
    Permissions.rems.read,
    Permissions.priorAuth.read,
    Permissions.buyAndBill.read,
    Permissions.inventory.read,
    Permissions.reimbursement.read,
    Permissions.claims.read,
    Permissions.era.read,
    Permissions.analytics.read,
    Permissions.benchmarking.read,
    Permissions.commandCenter.read,
    Permissions.automation.read,
    Permissions.revenue.read,
    Permissions.aiAssistant.read,
    Permissions.payerRules.read,
  ],
  ANALYST: [
    Permissions.clinics.read,
    Permissions.providers.read,
    Permissions.onboarding.read,
    Permissions.support.read,
    Permissions.training.read,
    Permissions.documents.read,
    Permissions.rems.read,
    Permissions.priorAuth.read,
    Permissions.buyAndBill.read,
    Permissions.inventory.read,
    Permissions.reimbursement.read,
    Permissions.claims.read,
    Permissions.era.read,
    Permissions.analytics.read,
    Permissions.benchmarking.read,
    Permissions.commandCenter.read,
    Permissions.automation.read,
    Permissions.revenue.read,
    Permissions.aiAssistant.read,
    Permissions.payerRules.read,
    Permissions.identity.read,
  ],

  // CLINIC
  CLINIC_ADMIN: [
    Permissions.clinics.read,
    Permissions.providers.read,
    Permissions.providers.manage,
    Permissions.onboarding.read,
    Permissions.support.read,
    Permissions.support.manage,
    Permissions.training.read,
    Permissions.training.manage,
    Permissions.documents.read,
    Permissions.documents.manage,
    Permissions.rems.read,
    Permissions.rems.attest,
    Permissions.priorAuth.read,
    Permissions.priorAuth.manage,
    Permissions.buyAndBill.read,
    Permissions.buyAndBill.manage,
    Permissions.inventory.read,
    Permissions.inventory.manage,
    Permissions.reimbursement.read,
    Permissions.reimbursement.manage,
    Permissions.claims.read,
    Permissions.claims.manage,
    Permissions.era.read,
    Permissions.era.manage,
    Permissions.analytics.read,
    Permissions.analytics.manage,
    Permissions.benchmarking.read,
    Permissions.benchmarking.manage,
    Permissions.commandCenter.read,
    Permissions.commandCenter.manage,
    Permissions.automation.read,
    Permissions.automation.manage,
    Permissions.revenue.read,
    Permissions.revenue.manage,
    Permissions.aiAssistant.read,
    Permissions.payerRules.read,
    Permissions.payerRules.manage,
    Permissions.identity.read,
  ],
  PROVIDER: [
    Permissions.clinics.read,
    Permissions.providers.read,
    Permissions.support.read,
    Permissions.training.read,
    Permissions.documents.read,
    Permissions.rems.read,
    Permissions.rems.attest,
    Permissions.priorAuth.read,
    Permissions.buyAndBill.read,
    Permissions.reimbursement.read,
    Permissions.claims.read,
    Permissions.era.read,
    Permissions.analytics.read,
    Permissions.benchmarking.read,
    Permissions.commandCenter.read,
    Permissions.automation.read,
    Permissions.revenue.read,
    Permissions.aiAssistant.read,
    Permissions.payerRules.read,
  ],
  BILLING_CONTACT: [
    Permissions.clinics.read,
    Permissions.support.read,
    Permissions.documents.read,
    Permissions.training.read,
    Permissions.priorAuth.read,
    Permissions.buyAndBill.read,
    Permissions.inventory.read,
    Permissions.reimbursement.read,
    Permissions.claims.read,
    Permissions.era.read,
    Permissions.analytics.read,
    Permissions.benchmarking.read,
    Permissions.commandCenter.read,
    Permissions.automation.read,
    Permissions.revenue.read,
    Permissions.aiAssistant.read,
    Permissions.payerRules.read,
  ],
  OPERATIONS_CONTACT: [
    Permissions.clinics.read,
    Permissions.providers.read,
    Permissions.onboarding.read,
    Permissions.support.read,
    Permissions.training.read,
    Permissions.documents.read,
    Permissions.rems.read,
    Permissions.rems.attest,
    Permissions.priorAuth.read,
    Permissions.buyAndBill.read,
    Permissions.inventory.read,
    Permissions.reimbursement.read,
    Permissions.claims.read,
    Permissions.era.read,
    Permissions.analytics.read,
    Permissions.benchmarking.read,
    Permissions.commandCenter.read,
    Permissions.automation.read,
    Permissions.revenue.read,
    Permissions.aiAssistant.read,
    Permissions.payerRules.read,
  ],
  READ_ONLY: [
    Permissions.clinics.read,
    Permissions.providers.read,
    Permissions.onboarding.read,
    Permissions.support.read,
    Permissions.training.read,
    Permissions.documents.read,
    Permissions.rems.read,
    Permissions.priorAuth.read,
    Permissions.buyAndBill.read,
    Permissions.inventory.read,
    Permissions.reimbursement.read,
    Permissions.claims.read,
    Permissions.era.read,
    Permissions.analytics.read,
    Permissions.benchmarking.read,
    Permissions.commandCenter.read,
    Permissions.automation.read,
    Permissions.revenue.read,
    Permissions.aiAssistant.read,
    Permissions.payerRules.read,
  ],
};

async function getGlobalRoleKeys(userId: string): Promise<AnyRoleKey[]> {
  const grants = await prisma.userOrganizationRole.findMany({
    where: { userId, role: { scope: "GLOBAL" } },
    select: { role: { select: { key: true } } },
  });
  return grants.map((g) => g.role.key as AnyRoleKey);
}

async function getOrganizationRoleKeys(userId: string, organizationId: string): Promise<AnyRoleKey[]> {
  const grants = await prisma.userOrganizationRole.findMany({
    where: { userId, organizationId },
    select: { role: { select: { key: true } } },
  });
  return grants.map((g) => g.role.key as AnyRoleKey);
}

async function getClinicRoleKeys(userId: string, clinicId: string): Promise<AnyRoleKey[]> {
  const grants = await prisma.userClinicRole.findMany({
    where: { userId, clinicId },
    select: { role: { select: { key: true } } },
  });
  return grants.map((g) => g.role.key as AnyRoleKey);
}

export async function getUserPermissionsForScope(
  userId: string,
  input: ScopeInput,
): Promise<Set<Permission>> {
  const globalRoleKeys = await getGlobalRoleKeys(userId);
  const permissions = new Set<Permission>();

  for (const key of globalRoleKeys) {
    for (const p of rolePermissions[key] ?? []) permissions.add(p);
  }

  if (input.scope === "ORGANIZATION") {
    const orgRoleKeys = await getOrganizationRoleKeys(userId, input.organizationId);
    for (const key of orgRoleKeys) {
      for (const p of rolePermissions[key] ?? []) permissions.add(p);
    }
  }

  if (input.scope === "CLINIC") {
    const clinic = await prisma.clinic.findUnique({
      where: { id: input.clinicId },
      select: { organizationId: true },
    });
    if (!clinic) return permissions;

    const [clinicRoleKeys, orgRoleKeys] = await Promise.all([
      getClinicRoleKeys(userId, input.clinicId),
      getOrganizationRoleKeys(userId, clinic.organizationId),
    ]);

    for (const key of [...orgRoleKeys, ...clinicRoleKeys]) {
      for (const p of rolePermissions[key] ?? []) permissions.add(p);
    }
  }

  return permissions;
}

export async function canAccessPermission(
  userId: string,
  permission: Permission,
  input: ScopeInput,
): Promise<boolean> {
  const access = await getAccessSnapshot(userId);

  if (input.scope === "GLOBAL") {
    // Permission checks for GLOBAL should only be satisfiable via global roles.
    const perms = await getUserPermissionsForScope(userId, { scope: "GLOBAL" });
    return perms.has(permission);
  }

  if (input.scope === "ORGANIZATION") {
    const hasTenantAccess =
      access.globalRoleKeys.length > 0 || access.accessibleOrganizationIds.includes(input.organizationId);
    if (!hasTenantAccess) return false;

    const perms = await getUserPermissionsForScope(userId, input);
    return perms.has(permission);
  }

  // CLINIC
  const hasTenantAccess =
    access.globalRoleKeys.length > 0 || access.accessibleClinicIds.includes(input.clinicId);
  if (!hasTenantAccess) return false;

  const perms = await getUserPermissionsForScope(userId, input);
  return perms.has(permission);
}

export async function requirePermission(
  userId: string,
  permission: Permission,
  input: ScopeInput,
) {
  const ok = await canAccessPermission(userId, permission, input);
  if (ok) return;

  const scope: PermissionScope = input.scope;
  throw new AppError("Insufficient permission", "UNAUTHORIZED", 403, {
    permission,
    scope,
    ...(input.scope === "ORGANIZATION" ? { organizationId: input.organizationId } : {}),
    ...(input.scope === "CLINIC" ? { clinicId: input.clinicId } : {}),
  });
}

