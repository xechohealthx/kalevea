import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import type { ServiceContext } from "@/server/services/service-context";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";

export async function listOnboardingProjects(ctx: ServiceContext) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  return prisma.clinicOnboardingProject.findMany({
    where: { clinicId: { in: access.accessibleClinicIds } },
    include: {
      clinic: { select: { id: true, name: true, status: true, clinicType: true } },
      owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function getOnboardingProject(ctx: ServiceContext, projectId: string) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const project = await prisma.clinicOnboardingProject.findUnique({
    where: { id: projectId },
    include: {
      clinic: { select: { id: true, name: true, clinicType: true, status: true } },
      owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      tasks: {
        orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  if (!project) throw new AppError("Onboarding project not found", "NOT_FOUND", 404);
  if (!access.accessibleClinicIds.includes(project.clinicId)) {
    throw new AppError("Project not accessible", "UNAUTHORIZED", 403);
  }

  return project;
}

export const updateOnboardingTaskSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
  assignedUserId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function updateOnboardingTask(
  ctx: ServiceContext,
  taskId: string,
  input: z.infer<typeof updateOnboardingTaskSchema>,
) {
  const task = await prisma.onboardingTask.findUnique({
    where: { id: taskId },
    include: { project: { select: { clinicId: true } } },
  });
  if (!task) throw new AppError("Task not found", "NOT_FOUND", 404);

  const access = await getAccessSnapshot(ctx.actorUserId);
  if (!access.accessibleClinicIds.includes(task.project.clinicId)) {
    throw new AppError("Task not accessible", "UNAUTHORIZED", 403);
  }

  const updated = await prisma.onboardingTask.update({
    where: { id: taskId },
    data: {
      status: input.status ?? undefined,
      assignedUserId:
        input.assignedUserId === undefined ? undefined : input.assignedUserId,
      dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, clinicId: task.project.clinicId },
    action: "UPDATE",
    entityType: "OnboardingTask",
    entityId: updated.id,
    clinicId: task.project.clinicId,
    metadata: { status: updated.status },
  });

  return updated;
}

