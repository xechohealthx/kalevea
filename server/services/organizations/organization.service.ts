import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import type { ServiceContext } from "@/server/services/service-context";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";

export async function getOrganization(ctx: ServiceContext, organizationId: string) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  if (access.globalRoleKeys.length === 0 && !access.accessibleOrganizationIds.includes(organizationId)) {
    throw new AppError("Organization not accessible", "UNAUTHORIZED", 403);
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new AppError("Organization not found", "NOT_FOUND", 404);
  return org;
}

export async function listOrganizations(ctx: ServiceContext) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  if (access.globalRoleKeys.length > 0) {
    return prisma.organization.findMany({ orderBy: { createdAt: "asc" } });
  }
  return prisma.organization.findMany({
    where: { id: { in: access.accessibleOrganizationIds } },
    orderBy: { createdAt: "asc" },
  });
}

