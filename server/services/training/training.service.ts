import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import type { ServiceContext } from "@/server/services/service-context";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";

export async function listCourses() {
  return prisma.trainingCourse.findMany({
    where: { isPublished: true },
    include: { _count: { select: { lessons: true, assignments: true } } },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function listAssignments(ctx: ServiceContext, clinicId?: string) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const clinicIds = clinicId ? [clinicId] : access.accessibleClinicIds;
  for (const cid of clinicIds) {
    if (!access.accessibleClinicIds.includes(cid)) {
      throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
    }
  }

  return prisma.trainingAssignment.findMany({
    where: { clinicId: { in: clinicIds } },
    include: {
      clinic: { select: { id: true, name: true } },
      course: { select: { id: true, title: true, slug: true } },
      provider: { select: { id: true, firstName: true, lastName: true } },
      staffProfile: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ assignedAt: "desc" }],
  });
}

