import { auth } from "@/lib/auth/server";
import { getHydratedPermissions, hydrateIdentity } from "@/lib/auth/identity";
import { logger } from "@/lib/logger";
import type { Permission } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils/errors";

export type CurrentActor = NonNullable<Awaited<ReturnType<typeof getCurrentActor>>>;

export async function getCurrentActor() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const identity = await hydrateIdentity(session.user.id, {
    organizationId: session.user.activeOrganizationId ?? null,
    clinicId: session.user.activeClinicId ?? null,
  });
  if (!identity) return null;

  const permissions = await getHydratedPermissions(identity);

  return {
    ...identity,
    permissions,
  };
}

export async function requireAuthenticatedUser() {
  const actor = await getCurrentActor();
  if (!actor) {
    logger.warn("Auth guard denied unauthenticated access");
    throw new AppError("Authentication required", "UNAUTHENTICATED", 401);
  }
  if (!actor.user.isActive) {
    logger.warn("Auth guard denied inactive user");
    throw new AppError("Inactive account", "UNAUTHORIZED", 403);
  }
  return actor;
}

export async function requireAuthenticatedUserId() {
  const actor = await requireAuthenticatedUser();
  return actor.user.id;
}

export async function requireWorkspaceAccess(
  actor: CurrentActor,
  input: { organizationId?: string | null; clinicId?: string | null },
) {
  if (input.organizationId) {
    const hasOrganizationAccess =
      actor.roleSummary.globalRoles.length > 0 ||
      actor.accessibleOrganizationIds.includes(input.organizationId);
    if (!hasOrganizationAccess) {
      logger.warn("Workspace access denied for organization");
      throw new AppError("Organization access denied", "UNAUTHORIZED", 403, {
        organizationId: input.organizationId,
      });
    }
  }

  if (input.clinicId) {
    const hasClinicAccess =
      actor.roleSummary.globalRoles.length > 0 || actor.accessibleClinicIds.includes(input.clinicId);
    if (!hasClinicAccess) {
      logger.warn("Workspace access denied for clinic");
      throw new AppError("Clinic access denied", "UNAUTHORIZED", 403, {
        clinicId: input.clinicId,
      });
    }
  }
}

export async function requirePermissionAccess(
  actor: CurrentActor,
  permission: Permission,
  input: { scope: "GLOBAL" } | { scope: "ORGANIZATION"; organizationId: string } | { scope: "CLINIC"; clinicId: string },
) {
  await requirePermission(actor.user.id, permission, input);
}
