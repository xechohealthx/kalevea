import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export type AccessSnapshot = {
  userId: string;
  globalRoleKeys: string[];
  organizationRoleKeysByOrgId: Record<string, string[]>;
  clinicRoleKeysByClinicId: Record<string, string[]>;
  accessibleOrganizationIds: string[];
  accessibleClinicIds: string[];
  defaultOrganizationId: string | null;
};

export async function getAccessSnapshot(userId: string): Promise<AccessSnapshot> {
  try {
    const [orgGrants, clinicGrants] = await Promise.all([
      prisma.userOrganizationRole.findMany({
        where: { userId },
        select: { organizationId: true, role: { select: { key: true, scope: true } } },
      }),
      prisma.userClinicRole.findMany({
        where: { userId },
        select: { clinicId: true, role: { select: { key: true, scope: true } } },
      }),
    ]);

    const globalRoleKeys = orgGrants
      .filter((g) => g.role.scope === "GLOBAL")
      .map((g) => g.role.key);

    const organizationRoleKeysByOrgId: Record<string, string[]> = {};
    for (const g of orgGrants) {
      organizationRoleKeysByOrgId[g.organizationId] ??= [];
      organizationRoleKeysByOrgId[g.organizationId].push(g.role.key);
    }

    const clinicRoleKeysByClinicId: Record<string, string[]> = {};
    for (const g of clinicGrants) {
      clinicRoleKeysByClinicId[g.clinicId] ??= [];
      clinicRoleKeysByClinicId[g.clinicId].push(g.role.key);
    }

    const accessibleOrganizationIds = Object.keys(organizationRoleKeysByOrgId);

    let accessibleClinicIds: string[] = [];
    if (globalRoleKeys.length > 0) {
      accessibleClinicIds = (
        await prisma.clinic.findMany({ select: { id: true } })
      ).map((c) => c.id);
    } else if (accessibleOrganizationIds.length > 0) {
      accessibleClinicIds = (
        await prisma.clinic.findMany({
          where: { organizationId: { in: accessibleOrganizationIds } },
          select: { id: true },
        })
      ).map((c) => c.id);
    } else {
      accessibleClinicIds = Object.keys(clinicRoleKeysByClinicId);
    }

    let defaultOrganizationId: string | null = accessibleOrganizationIds[0] ?? null;
    if (!defaultOrganizationId && accessibleClinicIds[0]) {
      const clinic = await prisma.clinic.findUnique({
        where: { id: accessibleClinicIds[0] },
        select: { organizationId: true },
      });
      defaultOrganizationId = clinic?.organizationId ?? null;
    }

    return {
      userId,
      globalRoleKeys,
      organizationRoleKeysByOrgId,
      clinicRoleKeysByClinicId,
      accessibleOrganizationIds,
      accessibleClinicIds,
      defaultOrganizationId,
    };
  } catch {
    logger.error("Access snapshot resolution failed", { userId });
    throw new Error("Failed to resolve access snapshot");
  }
}

