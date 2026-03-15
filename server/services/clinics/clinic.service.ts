import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import type { Prisma } from "@prisma/client";
import { requireOrganizationRole } from "@/lib/rbac/require";
import type { ServiceContext } from "@/server/services/service-context";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";

export const clinicFilterSchema = z.object({
  status: z.enum(["PROSPECT", "ONBOARDING", "ACTIVE", "PAUSED"]).optional(),
  clinicType: z.enum([
    "PRIMARY_CARE",
    "PSYCHIATRY",
    "HOSPITAL_OUTPATIENT",
    "SPECIALTY",
  ]).optional(),
  q: z.string().optional(),
});

export const createClinicSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase a-z, 0-9, and hyphens only"),
  clinicType: z.enum([
    "PRIMARY_CARE",
    "PSYCHIATRY",
    "HOSPITAL_OUTPATIENT",
    "SPECIALTY",
  ]),
  status: z.enum(["PROSPECT", "ONBOARDING", "ACTIVE", "PAUSED"]).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  timezone: z.string().optional(),
});

export async function listClinics(ctx: ServiceContext, filter: z.infer<typeof clinicFilterSchema>) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const where: Prisma.ClinicWhereInput = { id: { in: access.accessibleClinicIds } };

  if (filter.status) where.status = filter.status;
  if (filter.clinicType) where.clinicType = filter.clinicType;
  if (filter.q) {
    where.OR = [
      { name: { contains: filter.q, mode: "insensitive" } },
      { slug: { contains: filter.q, mode: "insensitive" } },
      { city: { contains: filter.q, mode: "insensitive" } },
      { state: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  return prisma.clinic.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      clinicType: true,
      status: true,
      city: true,
      state: true,
      timezone: true,
      organization: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createClinic(ctx: ServiceContext, input: z.infer<typeof createClinicSchema>) {
  await requireOrganizationRole(ctx.actorUserId, input.organizationId, ["ORG_ADMIN"]);

  const existing = await prisma.clinic.findUnique({
    where: { organizationId_slug: { organizationId: input.organizationId, slug: input.slug } },
    select: { id: true },
  });
  if (existing) throw new AppError("Clinic slug already exists", "CONFLICT", 409);

  const clinic = await prisma.clinic.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      slug: input.slug,
      clinicType: input.clinicType,
      status: input.status ?? "PROSPECT",
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country,
      phone: input.phone,
      email: input.email,
      timezone: input.timezone,
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: input.organizationId },
    action: "CREATE",
    entityType: "Clinic",
    entityId: clinic.id,
    organizationId: input.organizationId,
    clinicId: clinic.id,
    metadata: { clinicType: clinic.clinicType, status: clinic.status },
  });

  return clinic;
}

export async function getClinicById(ctx: ServiceContext, clinicId: string) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  if (!access.accessibleClinicIds.includes(clinicId)) {
    throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    include: { organization: true, onboarding: true },
  });
  if (!clinic) throw new AppError("Clinic not found", "NOT_FOUND", 404);
  return clinic;
}

