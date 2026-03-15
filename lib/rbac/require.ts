import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import type { AnyRoleKey, ClinicRoleKey, GlobalRoleKey, OrganizationRoleKey } from "./roles";

export async function requireAuth(userId: string | undefined | null) {
  if (!userId) throw new AppError("Authentication required", "UNAUTHENTICATED", 401);
  return userId;
}

export async function requireGlobalRole(userId: string, roles: GlobalRoleKey[]) {
  const ok = await prisma.userOrganizationRole.count({
    where: {
      userId,
      role: { scope: "GLOBAL", key: { in: roles } },
    },
  });
  if (ok > 0) return;
  throw new AppError("Insufficient global role", "UNAUTHORIZED", 403, { roles });
}

export async function requireOrganizationRole(
  userId: string,
  organizationId: string,
  roles: OrganizationRoleKey[] | AnyRoleKey[],
) {
  const ok = await prisma.userOrganizationRole.count({
    where: {
      userId,
      organizationId,
      role: { key: { in: roles as AnyRoleKey[] } },
    },
  });
  if (ok > 0) return;

  // Global roles can satisfy org access.
  const globalOk = await prisma.userOrganizationRole.count({
    where: {
      userId,
      role: { scope: "GLOBAL" },
    },
  });
  if (globalOk > 0) return;

  throw new AppError("Insufficient organization role", "UNAUTHORIZED", 403, {
    organizationId,
    roles,
  });
}

export async function requireClinicRole(
  userId: string,
  clinicId: string,
  roles: ClinicRoleKey[] | AnyRoleKey[],
) {
  const ok = await prisma.userClinicRole.count({
    where: {
      userId,
      clinicId,
      role: { key: { in: roles as AnyRoleKey[] } },
    },
  });
  if (ok > 0) return;

  // Organization/global roles can satisfy clinic access if the clinic belongs to an org
  // where the user has any org-scoped role.
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { organizationId: true },
  });
  if (!clinic) throw new AppError("Clinic not found", "NOT_FOUND", 404);

  const orgOk = await prisma.userOrganizationRole.count({
    where: {
      userId,
      organizationId: clinic.organizationId,
    },
  });
  if (orgOk > 0) return;

  throw new AppError("Insufficient clinic role", "UNAUTHORIZED", 403, { clinicId, roles });
}

