import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import type { ServiceContext } from "@/server/services/service-context";
import { createStatusEvent, listActivityForParent } from "@/server/services/workflow/workflow.service";
import type { ParentRef } from "@/server/services/workflow/workflow.types";

import { RemsParentTypes, type RemsReadinessSummary } from "./rems.types";

function withinDays(date: Date, days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  return date <= cutoff;
}

async function getDefaultProgramId() {
  const program = await prisma.remsProgram.findFirst({
    where: { isActive: true },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true },
  });
  if (!program) throw new AppError("No active REMS program configured", "NOT_FOUND", 404);
  return program.id;
}

export async function listPrograms(ctx: ServiceContext) {
  // Allow listing if the user has rems.read for any accessible tenant.
  const access = await getAccessSnapshot(ctx.actorUserId);
  if (access.globalRoleKeys.length > 0) {
    await requirePermission(ctx.actorUserId, Permissions.rems.read, { scope: "GLOBAL" });
  } else if (access.defaultOrganizationId && access.accessibleOrganizationIds.includes(access.defaultOrganizationId)) {
    await requirePermission(ctx.actorUserId, Permissions.rems.read, {
      scope: "ORGANIZATION",
      organizationId: access.defaultOrganizationId,
    });
  } else if (access.accessibleClinicIds[0]) {
    await requirePermission(ctx.actorUserId, Permissions.rems.read, {
      scope: "CLINIC",
      clinicId: access.accessibleClinicIds[0],
    });
  } else {
    throw new AppError("No tenant access", "UNAUTHORIZED", 403);
  }

  return prisma.remsProgram.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }],
  });
}

export async function getRemsDashboard(ctx: ServiceContext, input?: { remsProgramId?: string }) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const clinicIds = access.accessibleClinicIds;
  if (clinicIds.length === 0) throw new AppError("No clinic access", "UNAUTHORIZED", 403);

  await requirePermission(ctx.actorUserId, Permissions.rems.read, { scope: "CLINIC", clinicId: clinicIds[0] });

  const remsProgramId = input?.remsProgramId ?? (await getDefaultProgramId());

  const [program, clinics, providers, clinicEnrollments, providerEnrollments, requirements, attestations] =
    await Promise.all([
      prisma.remsProgram.findUnique({ where: { id: remsProgramId } }),
      prisma.clinic.findMany({
        where: { id: { in: clinicIds } },
        select: { id: true, name: true, organizationId: true },
        orderBy: { name: "asc" },
      }),
      prisma.provider.findMany({
        where: { clinicId: { in: clinicIds } },
        select: { id: true, clinicId: true, firstName: true, lastName: true, status: true },
      }),
      prisma.clinicRemsEnrollment.findMany({
        where: { clinicId: { in: clinicIds }, remsProgramId },
      }),
      prisma.providerRemsEnrollment.findMany({
        where: { clinicId: { in: clinicIds }, remsProgramId },
      }),
      prisma.remsRequirement.findMany({
        where: { remsProgramId, isActive: true },
        orderBy: [{ appliesToType: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.remsAttestation.findMany({
        where: { clinicId: { in: clinicIds }, remsProgramId },
        select: { id: true, clinicId: true, providerId: true, remsRequirementId: true, attestedAt: true },
      }),
    ]);

  if (!program) throw new AppError("REMS program not found", "NOT_FOUND", 404);

  const clinicReqs = requirements.filter((r) => r.appliesToType === "CLINIC" && r.requirementType === "ATTESTATION");
  const providerReqs = requirements.filter((r) => r.appliesToType === "PROVIDER" && r.requirementType === "ATTESTATION");

  const clinicRows = clinics.map((c) => {
    const enrollment = clinicEnrollments.find((e) => e.clinicId === c.id) ?? null;
    const providerIds = providers.filter((p) => p.clinicId === c.id).map((p) => p.id);

    const clinicAttestedReqIds = new Set(
      attestations
        .filter((a) => a.clinicId === c.id && !a.providerId && a.remsRequirementId)
        .map((a) => a.remsRequirementId!),
    );

    const providerAttestedPairs = new Set(
      attestations
        .filter((a) => a.clinicId === c.id && a.providerId && a.remsRequirementId)
        .map((a) => `${a.providerId}:${a.remsRequirementId}`),
    );

    const providerAttestableCount = providerReqs.length * providerIds.length;
    let providerAttestedCount = 0;
    for (const pid of providerIds) {
      for (const req of providerReqs) {
        if (providerAttestedPairs.has(`${pid}:${req.id}`)) providerAttestedCount += 1;
      }
    }

    return {
      clinicId: c.id,
      clinicName: c.name,
      organizationId: c.organizationId,
      remsProgramId,
      enrollmentId: enrollment?.id ?? null,
      status: enrollment?.status ?? null,
      expiresAt: enrollment?.expiresAt ?? null,
      clinicAttestedCount: [...clinicAttestedReqIds].filter((id) => clinicReqs.some((r) => r.id === id)).length,
      clinicAttestableCount: clinicReqs.length,
      providerAttestedCount,
      providerAttestableCount,
    };
  });

  const clinicById = new Map(clinics.map((c) => [c.id, c]));
  const providerById = new Map(providers.map((p) => [p.id, p]));

  const expiringClinicEnrollments = clinicEnrollments
    .filter((e) => e.expiresAt && withinDays(e.expiresAt, 30))
    .map((e) => ({
      kind: "CLINIC" as const,
      clinicId: e.clinicId,
      clinicName: clinicById.get(e.clinicId)?.name ?? "Clinic",
      providerId: null as string | null,
      providerName: null as string | null,
      status: e.status,
      expiresAt: e.expiresAt!,
    }));

  const expiringProviderEnrollments = providerEnrollments
    .filter((e) => e.expiresAt && withinDays(e.expiresAt, 30))
    .map((e) => ({
      kind: "PROVIDER" as const,
      clinicId: e.clinicId,
      clinicName: clinicById.get(e.clinicId)?.name ?? "Clinic",
      providerId: e.providerId,
      providerName: (() => {
        const p = providerById.get(e.providerId);
        return p ? `${p.firstName} ${p.lastName}`.trim() : "Provider";
      })(),
      status: e.status,
      expiresAt: e.expiresAt!,
    }));

  const expiredEnrollments =
    clinicEnrollments.filter((e) => e.status === "EXPIRED").length +
    providerEnrollments.filter((e) => e.status === "EXPIRED").length;

  const upcomingExpirations30d = expiringClinicEnrollments.length + expiringProviderEnrollments.length;

  const summary: RemsReadinessSummary = {
    totalRequirements: requirements.length,
    attestableRequirements: clinicReqs.length + providerReqs.length,
    attestedRequirements:
      clinicRows.reduce((acc, r) => acc + r.clinicAttestedCount, 0) +
      clinicRows.reduce((acc, r) => acc + r.providerAttestedCount, 0),
    expiredEnrollments,
    upcomingExpirations30d,
  };

  const upcomingExpirations = [...expiringClinicEnrollments, ...expiringProviderEnrollments]
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
    .slice(0, 10);

  const providerAttestedPairs = new Set(
    attestations
      .filter((a) => a.providerId && a.remsRequirementId)
      .map((a) => `${a.providerId}:${a.remsRequirementId}`),
  );

  const providerSnapshot = providers
    .map((p) => {
      const enr = providerEnrollments.find((e) => e.providerId === p.id) ?? null;
      let attested = 0;
      for (const req of providerReqs) {
        if (providerAttestedPairs.has(`${p.id}:${req.id}`)) attested += 1;
      }
      return {
        providerId: p.id,
        providerName: `${p.firstName} ${p.lastName}`.trim(),
        clinicId: p.clinicId,
        clinicName: clinicById.get(p.clinicId)?.name ?? "Clinic",
        enrollmentStatus: enr?.status ?? null,
        expiresAt: enr?.expiresAt ?? null,
        attested,
        attestable: providerReqs.length,
      };
    })
    .sort((a, b) => {
      const aExpired = a.enrollmentStatus === "EXPIRED" ? 1 : 0;
      const bExpired = b.enrollmentStatus === "EXPIRED" ? 1 : 0;
      if (aExpired !== bExpired) return bExpired - aExpired;
      const aPct = a.attestable ? a.attested / a.attestable : 1;
      const bPct = b.attestable ? b.attested / b.attestable : 1;
      if (aPct !== bPct) return aPct - bPct;
      const aExp = a.expiresAt ? a.expiresAt.getTime() : Number.POSITIVE_INFINITY;
      const bExp = b.expiresAt ? b.expiresAt.getTime() : Number.POSITIVE_INFINITY;
      return aExp - bExp;
    })
    .slice(0, 10);

  return { program, summary, clinics: clinicRows, upcomingExpirations, providerSnapshot };
}

export async function getClinicRemsOverview(
  ctx: ServiceContext,
  clinicId: string,
  input?: { remsProgramId?: string },
) {
  await requirePermission(ctx.actorUserId, Permissions.rems.read, { scope: "CLINIC", clinicId });

  const access = await getAccessSnapshot(ctx.actorUserId);
  if (access.globalRoleKeys.length === 0 && !access.accessibleClinicIds.includes(clinicId)) {
    throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, name: true, organizationId: true },
  });
  if (!clinic) throw new AppError("Clinic not found", "NOT_FOUND", 404);

  const remsProgramId = input?.remsProgramId ?? (await getDefaultProgramId());

  const [program, enrollment, providers, providerEnrollments, requirements, attestations] = await Promise.all([
    prisma.remsProgram.findUnique({ where: { id: remsProgramId } }),
    prisma.clinicRemsEnrollment.findUnique({
      where: { clinicId_remsProgramId: { clinicId, remsProgramId } },
    }),
    prisma.provider.findMany({
      where: { clinicId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.providerRemsEnrollment.findMany({
      where: { clinicId, remsProgramId },
    }),
    prisma.remsRequirement.findMany({
      where: {
        remsProgramId,
        isActive: true,
        OR: [
          { organizationId: null, clinicId: null },
          { organizationId: clinic.organizationId, clinicId: null },
          { organizationId: clinic.organizationId, clinicId },
          { organizationId: null, clinicId },
        ],
      },
      orderBy: [{ appliesToType: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.remsAttestation.findMany({
      where: { clinicId, remsProgramId },
      include: {
        attestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        provider: { select: { id: true, firstName: true, lastName: true } },
        requirement: { select: { id: true, title: true, appliesToType: true } },
      },
      orderBy: [{ attestedAt: "desc" }],
      take: 50,
    }),
  ]);

  if (!program) throw new AppError("REMS program not found", "NOT_FOUND", 404);

  const clinicReqs = requirements.filter((r) => r.appliesToType === "CLINIC" && r.requirementType === "ATTESTATION");
  const providerReqs = requirements.filter((r) => r.appliesToType === "PROVIDER" && r.requirementType === "ATTESTATION");

  const clinicAttestedReqIds = new Set(
    attestations.filter((a) => !a.providerId && a.remsRequirementId).map((a) => a.remsRequirementId!),
  );

  const providerAttestedPairs = new Set(
    attestations
      .filter((a) => a.providerId && a.remsRequirementId)
      .map((a) => `${a.providerId}:${a.remsRequirementId}`),
  );

  const providerRows = providers.map((p) => {
    const enr = providerEnrollments.find((e) => e.providerId === p.id) ?? null;
    const attestable = providerReqs.length;
    let attested = 0;
    for (const req of providerReqs) {
      if (providerAttestedPairs.has(`${p.id}:${req.id}`)) attested += 1;
    }
    return {
      providerId: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      status: p.status,
      enrollmentId: enr?.id ?? null,
      enrollmentStatus: enr?.status ?? null,
      expiresAt: enr?.expiresAt ?? null,
      attested,
      attestable,
    };
  });

  const readiness: RemsReadinessSummary = {
    totalRequirements: requirements.length,
    attestableRequirements: clinicReqs.length + providerReqs.length,
    attestedRequirements:
      [...clinicAttestedReqIds].filter((id) => clinicReqs.some((r) => r.id === id)).length +
      providerRows.reduce((acc, r) => acc + r.attested, 0),
    expiredEnrollments:
      (enrollment?.status === "EXPIRED" ? 1 : 0) +
      providerRows.filter((r) => r.enrollmentStatus === "EXPIRED").length,
    upcomingExpirations30d:
      (enrollment?.expiresAt && withinDays(enrollment.expiresAt, 30) ? 1 : 0) +
      providerRows.filter((r) => r.expiresAt && withinDays(r.expiresAt, 30)).length,
  };

  type ActivityRow = Awaited<ReturnType<typeof listActivityForParent>>[number];
  const activity: ActivityRow[] = [];
  if (enrollment?.id) {
    const parent: ParentRef = {
      organizationId: clinic.organizationId,
      clinicId: clinic.id,
      parentType: RemsParentTypes.clinicEnrollment,
      parentId: enrollment.id,
    };
    activity.push(...(await listActivityForParent(ctx, parent)));
  }

  return {
    program,
    clinic,
    enrollment,
    requirements,
    readiness,
    providers: providerRows,
    attestations,
    activity,
  };
}

export async function upsertClinicEnrollment(
  ctx: ServiceContext,
  clinicId: string,
  input: {
    remsProgramId: string;
    status: "NOT_ENROLLED" | "PENDING" | "ENROLLED" | "SUSPENDED" | "EXPIRED";
    enrolledAt?: Date | null;
    expiresAt?: Date | null;
    lastReviewedAt?: Date | null;
    notes?: string | null;
  },
) {
  await requirePermission(ctx.actorUserId, Permissions.rems.manage, { scope: "CLINIC", clinicId });

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, organizationId: true },
  });
  if (!clinic) throw new AppError("Clinic not found", "NOT_FOUND", 404);

  const existing = await prisma.clinicRemsEnrollment.findUnique({
    where: { clinicId_remsProgramId: { clinicId, remsProgramId: input.remsProgramId } },
  });

  const enrollment = await prisma.clinicRemsEnrollment.upsert({
    where: { clinicId_remsProgramId: { clinicId, remsProgramId: input.remsProgramId } },
    update: {
      status: input.status,
      enrolledAt: input.enrolledAt ?? null,
      expiresAt: input.expiresAt ?? null,
      lastReviewedAt: input.lastReviewedAt ?? null,
      notes: input.notes ?? null,
      updatedById: ctx.actorUserId,
    },
    create: {
      organizationId: clinic.organizationId,
      clinicId,
      remsProgramId: input.remsProgramId,
      status: input.status,
      enrolledAt: input.enrolledAt ?? null,
      expiresAt: input.expiresAt ?? null,
      lastReviewedAt: input.lastReviewedAt ?? null,
      notes: input.notes ?? null,
      createdById: ctx.actorUserId,
      updatedById: ctx.actorUserId,
    },
  });

  await createStatusEvent(
    ctx,
    {
      organizationId: clinic.organizationId,
      clinicId,
      parentType: RemsParentTypes.clinicEnrollment,
      parentId: enrollment.id,
      fromStatus: existing?.status ?? null,
      toStatus: enrollment.status,
      note: input.notes ?? null,
    },
    { permission: Permissions.rems.manage },
  );

  await writeAuditLog({
    ctx: { ...ctx, organizationId: clinic.organizationId, clinicId },
    action: existing ? "UPDATE" : "CREATE",
    entityType: "ClinicRemsEnrollment",
    entityId: enrollment.id,
    organizationId: clinic.organizationId,
    clinicId,
    metadata: { status: enrollment.status, remsProgramId: enrollment.remsProgramId },
  });

  return enrollment;
}

export async function upsertProviderEnrollment(
  ctx: ServiceContext,
  providerId: string,
  input: {
    remsProgramId: string;
    status: "NOT_ENROLLED" | "PENDING" | "ENROLLED" | "SUSPENDED" | "EXPIRED";
    enrolledAt?: Date | null;
    expiresAt?: Date | null;
    lastReviewedAt?: Date | null;
    notes?: string | null;
  },
) {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { id: true, clinicId: true, clinic: { select: { organizationId: true } } },
  });
  if (!provider) throw new AppError("Provider not found", "NOT_FOUND", 404);

  await requirePermission(ctx.actorUserId, Permissions.rems.manage, { scope: "CLINIC", clinicId: provider.clinicId });

  const existing = await prisma.providerRemsEnrollment.findUnique({
    where: { providerId_remsProgramId: { providerId, remsProgramId: input.remsProgramId } },
  });

  const enrollment = await prisma.providerRemsEnrollment.upsert({
    where: { providerId_remsProgramId: { providerId, remsProgramId: input.remsProgramId } },
    update: {
      status: input.status,
      enrolledAt: input.enrolledAt ?? null,
      expiresAt: input.expiresAt ?? null,
      lastReviewedAt: input.lastReviewedAt ?? null,
      notes: input.notes ?? null,
      updatedById: ctx.actorUserId,
    },
    create: {
      organizationId: provider.clinic.organizationId,
      clinicId: provider.clinicId,
      providerId,
      remsProgramId: input.remsProgramId,
      status: input.status,
      enrolledAt: input.enrolledAt ?? null,
      expiresAt: input.expiresAt ?? null,
      lastReviewedAt: input.lastReviewedAt ?? null,
      notes: input.notes ?? null,
      createdById: ctx.actorUserId,
      updatedById: ctx.actorUserId,
    },
  });

  await createStatusEvent(
    ctx,
    {
      organizationId: provider.clinic.organizationId,
      clinicId: provider.clinicId,
      parentType: RemsParentTypes.providerEnrollment,
      parentId: enrollment.id,
      fromStatus: existing?.status ?? null,
      toStatus: enrollment.status,
      note: input.notes ?? null,
    },
    { permission: Permissions.rems.manage },
  );

  await writeAuditLog({
    ctx: { ...ctx, organizationId: provider.clinic.organizationId, clinicId: provider.clinicId },
    action: existing ? "UPDATE" : "CREATE",
    entityType: "ProviderRemsEnrollment",
    entityId: enrollment.id,
    organizationId: provider.clinic.organizationId,
    clinicId: provider.clinicId,
    metadata: { status: enrollment.status, providerId, remsProgramId: enrollment.remsProgramId },
  });

  return enrollment;
}

export async function getProviderRemsOverview(
  ctx: ServiceContext,
  providerId: string,
  input?: { remsProgramId?: string },
) {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: { clinic: { select: { id: true, name: true, organizationId: true } } },
  });
  if (!provider) throw new AppError("Provider not found", "NOT_FOUND", 404);

  await requirePermission(ctx.actorUserId, Permissions.rems.read, { scope: "CLINIC", clinicId: provider.clinicId });

  const remsProgramId = input?.remsProgramId ?? (await getDefaultProgramId());
  const [program, enrollment, requirements, attestations] = await Promise.all([
    prisma.remsProgram.findUnique({ where: { id: remsProgramId } }),
    prisma.providerRemsEnrollment.findUnique({
      where: { providerId_remsProgramId: { providerId, remsProgramId } },
    }),
    prisma.remsRequirement.findMany({
      where: {
        remsProgramId,
        isActive: true,
        appliesToType: "PROVIDER",
        OR: [
          { organizationId: null, clinicId: null },
          { organizationId: provider.clinic.organizationId, clinicId: null },
          { organizationId: provider.clinic.organizationId, clinicId: provider.clinicId },
          { organizationId: null, clinicId: provider.clinicId },
        ],
      },
      orderBy: [{ sortOrder: "asc" }],
    }),
    prisma.remsAttestation.findMany({
      where: { providerId, remsProgramId },
      include: {
        attestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        requirement: { select: { id: true, title: true } },
      },
      orderBy: [{ attestedAt: "desc" }],
      take: 50,
    }),
  ]);

  if (!program) throw new AppError("REMS program not found", "NOT_FOUND", 404);

  const attestableReqs = requirements.filter((r) => r.requirementType === "ATTESTATION");
  const attestedReqIds = new Set(attestations.filter((a) => a.remsRequirementId).map((a) => a.remsRequirementId!));

  const readiness: RemsReadinessSummary = {
    totalRequirements: requirements.length,
    attestableRequirements: attestableReqs.length,
    attestedRequirements: attestableReqs.filter((r) => attestedReqIds.has(r.id)).length,
    expiredEnrollments: enrollment?.status === "EXPIRED" ? 1 : 0,
    upcomingExpirations30d: enrollment?.expiresAt && withinDays(enrollment.expiresAt, 30) ? 1 : 0,
  };

  type ActivityRow = Awaited<ReturnType<typeof listActivityForParent>>[number];
  const activity: ActivityRow[] = [];
  if (enrollment?.id) {
    activity.push(
      ...(await listActivityForParent(ctx, {
        organizationId: provider.clinic.organizationId,
        clinicId: provider.clinicId,
        parentType: RemsParentTypes.providerEnrollment,
        parentId: enrollment.id,
      })),
    );
  }

  return { program, provider, enrollment, requirements, readiness, attestations, activity };
}

export async function createAttestation(
  ctx: ServiceContext,
  input: {
    remsProgramId: string;
    clinicId: string;
    providerId?: string | null;
    remsRequirementId?: string | null;
    title: string;
    notes?: string | null;
    attestedAt?: Date | null;
  },
) {
  await requirePermission(ctx.actorUserId, Permissions.rems.attest, { scope: "CLINIC", clinicId: input.clinicId });

  const clinic = await prisma.clinic.findUnique({
    where: { id: input.clinicId },
    select: { id: true, organizationId: true },
  });
  if (!clinic) throw new AppError("Clinic not found", "NOT_FOUND", 404);

  if (input.providerId) {
    const provider = await prisma.provider.findUnique({
      where: { id: input.providerId },
      select: { id: true, clinicId: true },
    });
    if (!provider) throw new AppError("Provider not found", "NOT_FOUND", 404);
    if (provider.clinicId !== input.clinicId) {
      throw new AppError("Provider is not in this clinic", "CONFLICT", 409);
    }
  }

  let clinicEnrollmentId: string | null = null;
  let providerEnrollmentId: string | null = null;

  if (input.providerId) {
    const pe = await prisma.providerRemsEnrollment.findUnique({
      where: { providerId_remsProgramId: { providerId: input.providerId, remsProgramId: input.remsProgramId } },
      select: { id: true },
    });
    providerEnrollmentId = pe?.id ?? null;
  } else {
    const ce = await prisma.clinicRemsEnrollment.findUnique({
      where: { clinicId_remsProgramId: { clinicId: input.clinicId, remsProgramId: input.remsProgramId } },
      select: { id: true },
    });
    clinicEnrollmentId = ce?.id ?? null;
  }

  const attestation = await prisma.remsAttestation.create({
    data: {
      organizationId: clinic.organizationId,
      clinicId: input.clinicId,
      remsProgramId: input.remsProgramId,
      remsRequirementId: input.remsRequirementId ?? null,
      providerId: input.providerId ?? null,
      clinicRemsEnrollmentId: clinicEnrollmentId,
      providerRemsEnrollmentId: providerEnrollmentId,
      title: input.title,
      attestedById: ctx.actorUserId,
      attestedAt: input.attestedAt ?? new Date(),
      notes: input.notes ?? null,
    },
  });

  await prisma.activityEvent.create({
    data: {
      organizationId: clinic.organizationId,
      clinicId: input.clinicId,
      parentType: input.providerId ? RemsParentTypes.providerEnrollment : RemsParentTypes.clinicEnrollment,
      parentId: input.providerId ? (providerEnrollmentId ?? input.providerId) : (clinicEnrollmentId ?? input.clinicId),
      type: "REMS_ATTESTED",
      title: "Attestation recorded",
      description: input.title,
      createdById: ctx.actorUserId,
      metadata: { remsRequirementId: input.remsRequirementId ?? null },
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: clinic.organizationId, clinicId: input.clinicId },
    action: "CREATE",
    entityType: "RemsAttestation",
    entityId: attestation.id,
    organizationId: clinic.organizationId,
    clinicId: input.clinicId,
    metadata: {
      remsProgramId: input.remsProgramId,
      providerId: input.providerId ?? null,
      remsRequirementId: input.remsRequirementId ?? null,
    },
  });

  return attestation;
}

