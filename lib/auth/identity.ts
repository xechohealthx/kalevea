import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import type { Permission } from "@/lib/rbac/permissions";
import { getUserPermissionsForScope } from "@/lib/rbac/check";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";

export type SessionRoleSummary = {
  globalRoles: string[];
  organizationRoleCount: number;
  clinicRoleCount: number;
};

export type HydratedIdentity = {
  user: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
    invitationStatus: "PENDING" | "ACCEPTED" | "REVOKED";
  };
  activeOrganizationId: string | null;
  activeClinicId: string | null;
  roleSummary: SessionRoleSummary;
  accessibleOrganizationIds: string[];
  accessibleClinicIds: string[];
};

export async function hydrateIdentity(
  userId: string,
  preferred?: { organizationId?: string | null; clinicId?: string | null },
): Promise<HydratedIdentity | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      invitationStatus: true,
    },
  });
  if (!user) return null;

  const access = await getAccessSnapshot(userId);
  const requestedOrgId = preferred?.organizationId ?? null;
  const requestedClinicId = preferred?.clinicId ?? null;

  const activeOrganizationId =
    requestedOrgId && access.accessibleOrganizationIds.includes(requestedOrgId)
      ? requestedOrgId
      : access.defaultOrganizationId;
  const activeClinicId =
    requestedClinicId && access.accessibleClinicIds.includes(requestedClinicId)
      ? requestedClinicId
      : access.accessibleClinicIds[0] ?? null;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      isActive: user.isActive,
      invitationStatus: user.invitationStatus,
    },
    activeOrganizationId,
    activeClinicId,
    roleSummary: {
      globalRoles: access.globalRoleKeys,
      organizationRoleCount: Object.keys(access.organizationRoleKeysByOrgId).length,
      clinicRoleCount: Object.keys(access.clinicRoleKeysByClinicId).length,
    },
    accessibleOrganizationIds: access.accessibleOrganizationIds,
    accessibleClinicIds: access.accessibleClinicIds,
  };
}

export async function getHydratedPermissions(identity: HydratedIdentity): Promise<{
  organizationPermissions: Permission[];
  clinicPermissions: Permission[];
}> {
  const [orgPerms, clinicPerms] = await Promise.all([
    identity.activeOrganizationId
      ? getUserPermissionsForScope(identity.user.id, {
          scope: "ORGANIZATION",
          organizationId: identity.activeOrganizationId,
        })
      : Promise.resolve(new Set<Permission>()),
    identity.activeClinicId
      ? getUserPermissionsForScope(identity.user.id, {
          scope: "CLINIC",
          clinicId: identity.activeClinicId,
        })
      : Promise.resolve(new Set<Permission>()),
  ]);

  return {
    organizationPermissions: [...orgPerms],
    clinicPermissions: [...clinicPerms],
  };
}

export async function markUserAuthenticated(input: {
  userId: string;
  providerType: "DEVELOPMENT_CREDENTIALS" | "EMAIL" | "GOOGLE" | "OIDC";
  providerAccountId?: string | null;
}) {
  try {
    const now = new Date();
    await prisma.user.update({
      where: { id: input.userId },
      data: {
        authProviderType: input.providerType,
        externalAuthProviderId: input.providerAccountId ?? undefined,
        invitationStatus: "ACCEPTED",
        acceptedAt: now,
        isActive: true,
      },
    });
  } catch {
    logger.warn("Failed to update authenticated user provider metadata", {
      userId: input.userId,
      providerType: input.providerType,
    });
  }
}
