import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import type { Prisma } from "@prisma/client";
import type { ServiceContext } from "@/server/services/service-context";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";

export const documentFilterSchema = z.object({
  clinicId: z.string().optional(),
  organizationId: z.string().optional(),
  category: z
    .enum(["CONTRACT", "ONBOARDING", "TRAINING", "COMPLIANCE", "SUPPORT", "GENERAL"])
    .optional(),
});

export const createDocumentSchema = z.object({
  clinicId: z.string().optional(),
  organizationId: z.string().optional(),
  category: z.enum(["CONTRACT", "ONBOARDING", "TRAINING", "COMPLIANCE", "SUPPORT", "GENERAL"]),
  title: z.string().min(2),
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
});

export async function listDocuments(
  ctx: ServiceContext,
  filter: z.infer<typeof documentFilterSchema>,
) {
  const access = await getAccessSnapshot(ctx.actorUserId);

  const where: Prisma.DocumentWhereInput = {};
  if (filter.clinicId) {
    if (!access.accessibleClinicIds.includes(filter.clinicId)) {
      throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
    }
    where.clinicId = filter.clinicId;
  } else {
    where.OR = [
      { clinicId: { in: access.accessibleClinicIds } },
      ...(access.accessibleOrganizationIds.length
        ? [{ organizationId: { in: access.accessibleOrganizationIds } }]
        : []),
    ];
  }

  if (filter.organizationId) where.organizationId = filter.organizationId;
  if (filter.category) where.category = filter.category;

  return prisma.document.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      clinic: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true } },
      uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}

export async function createDocument(ctx: ServiceContext, input: z.infer<typeof createDocumentSchema>) {
  const access = await getAccessSnapshot(ctx.actorUserId);

  if (!input.clinicId && !input.organizationId) {
    throw new AppError("Either clinicId or organizationId is required", "VALIDATION_ERROR", 400);
  }

  if (input.clinicId && !access.accessibleClinicIds.includes(input.clinicId)) {
    throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
  }

  if (input.organizationId && access.accessibleOrganizationIds.length) {
    if (!access.accessibleOrganizationIds.includes(input.organizationId)) {
      throw new AppError("Organization not accessible", "UNAUTHORIZED", 403);
    }
  }

  const doc = await prisma.document.create({
    data: {
      clinicId: input.clinicId ?? null,
      organizationId: input.organizationId ?? null,
      category: input.category,
      title: input.title,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      uploadedByUserId: ctx.actorUserId,
    },
  });

  await writeAuditLog({
    ctx,
    action: "CREATE",
    entityType: "Document",
    entityId: doc.id,
    organizationId: doc.organizationId,
    clinicId: doc.clinicId,
    metadata: { category: doc.category, mimeType: doc.mimeType, fileSize: doc.fileSize },
  });

  return doc;
}

