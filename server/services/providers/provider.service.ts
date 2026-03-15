import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import type { Prisma } from "@prisma/client";
import type { ServiceContext } from "@/server/services/service-context";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";

export const providerFilterSchema = z.object({
  clinicId: z.string().optional(),
  q: z.string().optional(),
});

export const createProviderSchema = z.object({
  clinicId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  credentials: z.string().optional(),
  specialty: z.string().optional(),
  npi: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const createStaffSchema = z.object({
  clinicId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  title: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function listProviders(ctx: ServiceContext, filter: z.infer<typeof providerFilterSchema>) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const clinicIds = filter.clinicId ? [filter.clinicId] : access.accessibleClinicIds;
  for (const cid of clinicIds) {
    if (!access.accessibleClinicIds.includes(cid)) {
      throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
    }
  }

  const where: Prisma.ProviderWhereInput = { clinicId: { in: clinicIds } };
  if (filter.q) {
    where.OR = [
      { firstName: { contains: filter.q, mode: "insensitive" } },
      { lastName: { contains: filter.q, mode: "insensitive" } },
      { npi: { contains: filter.q, mode: "insensitive" } },
      { email: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  return prisma.provider.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: { clinic: { select: { id: true, name: true } } },
  });
}

export async function listStaffProfiles(
  ctx: ServiceContext,
  filter: z.infer<typeof providerFilterSchema>,
) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const clinicIds = filter.clinicId ? [filter.clinicId] : access.accessibleClinicIds;
  for (const cid of clinicIds) {
    if (!access.accessibleClinicIds.includes(cid)) {
      throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
    }
  }

  const where: Prisma.StaffProfileWhereInput = { clinicId: { in: clinicIds } };
  if (filter.q) {
    where.OR = [
      { firstName: { contains: filter.q, mode: "insensitive" } },
      { lastName: { contains: filter.q, mode: "insensitive" } },
      { title: { contains: filter.q, mode: "insensitive" } },
      { email: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  return prisma.staffProfile.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: { clinic: { select: { id: true, name: true } } },
  });
}

export async function createProvider(ctx: ServiceContext, input: z.infer<typeof createProviderSchema>) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  if (!access.accessibleClinicIds.includes(input.clinicId)) {
    throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
  }

  const provider = await prisma.provider.create({
    data: {
      clinicId: input.clinicId,
      firstName: input.firstName,
      lastName: input.lastName,
      credentials: input.credentials,
      specialty: input.specialty,
      npi: input.npi,
      email: input.email,
      phone: input.phone,
      status: input.status ?? "ACTIVE",
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, clinicId: input.clinicId },
    action: "CREATE",
    entityType: "Provider",
    entityId: provider.id,
    clinicId: input.clinicId,
    metadata: { status: provider.status, npi: provider.npi ?? null },
  });

  return provider;
}

export async function createStaffProfile(ctx: ServiceContext, input: z.infer<typeof createStaffSchema>) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  if (!access.accessibleClinicIds.includes(input.clinicId)) {
    throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
  }

  const staff = await prisma.staffProfile.create({
    data: {
      clinicId: input.clinicId,
      firstName: input.firstName,
      lastName: input.lastName,
      title: input.title,
      email: input.email,
      phone: input.phone,
      status: input.status ?? "ACTIVE",
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, clinicId: input.clinicId },
    action: "CREATE",
    entityType: "StaffProfile",
    entityId: staff.id,
    clinicId: input.clinicId,
    metadata: { status: staff.status, title: staff.title ?? null },
  });

  return staff;
}

