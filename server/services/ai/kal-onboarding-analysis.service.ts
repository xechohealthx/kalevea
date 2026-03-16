import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import type { ServiceContext } from "@/server/services/service-context";
import { listOnboardingProjects, getOnboardingProject } from "@/server/services/onboarding/onboarding.service";

async function resolveScope(ctx: ServiceContext, input: { organizationId?: string; clinicId?: string }) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const organizationId = input.organizationId ?? access.defaultOrganizationId ?? undefined;
  if (!organizationId) throw new AppError("No organization access", "UNAUTHORIZED", 403);
  await requirePermission(ctx.actorUserId, Permissions.aiAssistant.read, {
    scope: "ORGANIZATION",
    organizationId,
  });
  return { organizationId, clinicId: input.clinicId };
}

function summarizeMissingAreas(input: {
  blockedTasks: Array<{ title: string; category: string }>;
  providerCount: number;
  remsEnrollmentCount: number;
}) {
  const missing = new Set<string>();
  if (input.providerCount === 0) missing.add("provider credentialing");
  if (input.remsEnrollmentCount === 0) missing.add("REMS enrollment");
  for (const task of input.blockedTasks) {
    if (task.category === "LEGAL") missing.add("legal setup");
    if (task.category === "BILLING") missing.add("payer enrollment");
    if (task.category === "TECHNICAL") missing.add("technical integration");
    if (task.category === "TRAINING") missing.add("training completion");
    if (task.category === "OPERATIONS") missing.add("operations checklist");
  }
  return Array.from(missing);
}

export async function identifyOnboardingBlockers(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  const scope = await resolveScope(ctx, input);
  const projects = await listOnboardingProjects({ actorUserId: ctx.actorUserId, organizationId: scope.organizationId });
  const filtered = scope.clinicId ? projects.filter((project) => project.clinicId === scope.clinicId) : projects;

  const blockers = [];
  for (const project of filtered.slice(0, 10)) {
    const detail = await getOnboardingProject(
      { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: project.clinicId },
      project.id,
    );
    const blocked = detail.tasks
      .filter((task) => task.status === "BLOCKED")
      .map((task) => ({ taskId: task.id, title: task.title, category: task.category, dueDate: task.dueDate }));
    blockers.push({
      projectId: detail.id,
      clinicId: detail.clinic.id,
      clinicName: detail.clinic.name,
      blockedTasks: blocked,
      blockerCount: blocked.length,
    });
  }

  logger.info("Kal onboarding blockers identified", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
    count: blockers.length,
  });
  return blockers;
}

export async function analyzeClinicOnboardingReadiness(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string },
) {
  const scope = await resolveScope(ctx, input);
  const projects = await listOnboardingProjects({ actorUserId: ctx.actorUserId, organizationId: scope.organizationId });
  const filtered = scope.clinicId ? projects.filter((project) => project.clinicId === scope.clinicId) : projects;

  if (filtered.length === 0) {
    return [];
  }

  const readiness = [];
  for (const project of filtered.slice(0, 10)) {
    const detail = await getOnboardingProject(
      { actorUserId: ctx.actorUserId, organizationId: scope.organizationId, clinicId: project.clinicId },
      project.id,
    );
    const totalTasks = detail.tasks.length;
    const doneTasks = detail.tasks.filter((task) => task.status === "DONE").length;
    const blockedTasks = detail.tasks
      .filter((task) => task.status === "BLOCKED")
      .map((task) => ({ title: task.title, category: task.category }));
    const inProgressTasks = detail.tasks.filter((task) => task.status === "IN_PROGRESS").length;

    const [providerCount, remsEnrollmentCount, documentCount] = await Promise.all([
      prisma.provider.count({ where: { clinicId: detail.clinic.id } }),
      prisma.clinicRemsEnrollment.count({ where: { clinicId: detail.clinic.id, status: "ENROLLED" } }),
      prisma.document.count({ where: { clinicId: detail.clinic.id } }),
    ]);

    const progressPct = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;
    const missingAreas = summarizeMissingAreas({ blockedTasks, providerCount, remsEnrollmentCount });
    const readinessBand: "NOT_READY" | "AT_RISK" | "READY" =
      progressPct >= 85 && blockedTasks.length === 0 && providerCount > 0 && remsEnrollmentCount > 0
        ? "READY"
        : progressPct >= 60
          ? "AT_RISK"
          : "NOT_READY";

    readiness.push({
      projectId: detail.id,
      clinicId: detail.clinic.id,
      clinicName: detail.clinic.name,
      onboardingStatus: detail.status,
      progressPct,
      totalTasks,
      doneTasks,
      blockedTaskCount: blockedTasks.length,
      inProgressTaskCount: inProgressTasks,
      providerCount,
      remsEnrollmentCount,
      documentCount,
      missingAreas,
      readinessBand,
    });
  }

  logger.info("Kal onboarding readiness analyzed", {
    actorUserId: ctx.actorUserId,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
    count: readiness.length,
  });
  return readiness;
}
