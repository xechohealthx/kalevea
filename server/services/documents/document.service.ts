import { z } from "zod";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/rbac/check";
import type { ServiceContext } from "@/server/services/service-context";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import {
  createSignedDownloadUrl,
  createSignedUploadUrl,
  deleteObject,
  verifyObjectExists,
} from "@/server/services/storage/s3.service";
import { attachDocumentToParent } from "@/server/services/workflow/workflow.service";
import { Permissions } from "@/lib/rbac/permissions";

export const documentFilterSchema = z.object({
  clinicId: z.string().optional(),
  organizationId: z.string().optional(),
  category: z
    .enum(["CONTRACT", "ONBOARDING", "TRAINING", "COMPLIANCE", "SUPPORT", "GENERAL", "ERA_REMITTANCE"])
    .optional(),
});

export const createDocumentSchema = z.object({
  clinicId: z.string().optional(),
  organizationId: z.string().optional(),
  category: z.enum(["CONTRACT", "ONBOARDING", "TRAINING", "COMPLIANCE", "SUPPORT", "GENERAL", "ERA_REMITTANCE"]),
  title: z.string().min(2),
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
});

export const DOCUMENT_MIME_POLICY = {
  GENERAL: ["application/pdf", "image/png", "image/jpeg", "image/jpg", "text/plain"],
  CONTRACT: ["application/pdf"],
  ONBOARDING: ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
  TRAINING: ["application/pdf"],
  COMPLIANCE: ["application/pdf"],
  SUPPORT: ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
  ERA_REMITTANCE: [
    "text/plain",
    "application/octet-stream",
    "application/edi-x12",
    "application/x12",
  ],
} as const;

const allAllowedMimeTypes = new Set<string>(Object.values(DOCUMENT_MIME_POLICY).flat());

export const DOCUMENT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const workflowParentSchema = z.object({
  parentType: z.string().min(1),
  parentId: z.string().min(1),
});

export const createDocumentUploadUrlSchema = z
  .object({
    filename: z.string().min(1),
    mimeType: z.string().min(1),
    size: z.number().int().positive().max(DOCUMENT_MAX_UPLOAD_BYTES),
    organizationId: z.string().optional(),
    clinicId: z.string().optional(),
    category: z.enum(["CONTRACT", "ONBOARDING", "TRAINING", "COMPLIANCE", "SUPPORT", "GENERAL", "ERA_REMITTANCE"]),
    title: z.string().min(2),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    workflowParent: workflowParentSchema.optional(),
  })
  .superRefine((input, ctx) => {
    if (!input.organizationId && !input.clinicId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organizationId"],
        message: "Either organizationId or clinicId is required",
      });
    }
    if (!allAllowedMimeTypes.has(input.mimeType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mimeType"],
        message: "Unsupported mime type for document uploads",
      });
    }
  });

export const finalizeDocumentUploadSchema = z
  .object({
    storageKey: z.string().min(1),
    mimeType: z.string().min(1),
    fileSize: z.number().int().positive().max(DOCUMENT_MAX_UPLOAD_BYTES),
    organizationId: z.string().optional(),
    clinicId: z.string().optional(),
    category: z.enum(["CONTRACT", "ONBOARDING", "TRAINING", "COMPLIANCE", "SUPPORT", "GENERAL", "ERA_REMITTANCE"]),
    title: z.string().min(2),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    workflowParent: workflowParentSchema.optional(),
  })
  .superRefine((input, ctx) => {
    if (!input.organizationId && !input.clinicId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organizationId"],
        message: "Either organizationId or clinicId is required",
      });
    }
    if (!allAllowedMimeTypes.has(input.mimeType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mimeType"],
        message: "Unsupported mime type for document uploads",
      });
    }
  });

export const attachDocumentForWorkflowSchema = z.object({
  documentId: z.string().min(1),
  organizationId: z.string().optional(),
  clinicId: z.string().optional(),
  parentType: z.string().min(1),
  parentId: z.string().min(1),
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

function sanitizeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 120);
}

async function resolveScope(
  ctx: ServiceContext,
  input: {
    organizationId?: string;
    clinicId?: string;
  },
) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  if (!input.clinicId && !input.organizationId) {
    throw new AppError("Either clinicId or organizationId is required", "VALIDATION_ERROR", 400);
  }

  if (input.clinicId) {
    if (!access.accessibleClinicIds.includes(input.clinicId)) {
      throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
    }
    const clinic = await prisma.clinic.findUnique({
      where: { id: input.clinicId },
      select: { organizationId: true },
    });
    if (!clinic) throw new AppError("Clinic not found", "NOT_FOUND", 404);
    return { organizationId: clinic.organizationId, clinicId: input.clinicId };
  }

  if (input.organizationId && access.accessibleOrganizationIds.length > 0) {
    if (!access.accessibleOrganizationIds.includes(input.organizationId)) {
      throw new AppError("Organization not accessible", "UNAUTHORIZED", 403);
    }
  }

  return { organizationId: input.organizationId!, clinicId: null };
}

async function enforceDocumentPermission(
  ctx: ServiceContext,
  scope: { organizationId: string; clinicId: string | null },
  action: "read" | "manage",
) {
  if (scope.clinicId) {
    await requirePermission(ctx.actorUserId, action === "read" ? Permissions.documents.read : Permissions.documents.manage, {
      scope: "CLINIC",
      clinicId: scope.clinicId,
    });
    return;
  }

  await requirePermission(ctx.actorUserId, action === "read" ? Permissions.documents.read : Permissions.documents.manage, {
    scope: "ORGANIZATION",
    organizationId: scope.organizationId,
  });
}

function ensureStorageKeyInScope(input: {
  storageKey: string;
  organizationId: string;
  clinicId: string | null;
}) {
  const expectedPrefix = input.clinicId
    ? `org/${input.organizationId}/clinic/${input.clinicId}/documents/`
    : `org/${input.organizationId}/documents/`;
  if (!input.storageKey.startsWith(expectedPrefix)) {
    throw new AppError("Storage key outside allowed tenant scope", "UNAUTHORIZED", 403);
  }
}

function validateMimeForCategory(input: {
  category: keyof typeof DOCUMENT_MIME_POLICY;
  mimeType: string;
}) {
  const allowed = (DOCUMENT_MIME_POLICY[input.category] ?? []) as readonly string[];
  if (!allowed.includes(input.mimeType)) {
    logger.warn("Document upload rejected due to mime policy");
    throw new AppError(
      `MIME type not allowed for category ${input.category}`,
      "VALIDATION_ERROR",
      400,
      { code: "INVALID_MIME_FOR_CATEGORY" },
    );
  }
}

async function cleanupOrphanedObject(storageKey: string) {
  try {
    await deleteObject({ storageKey });
  } catch {
    logger.warn("Failed to cleanup orphaned uploaded object");
  }
}

export async function requestDocumentUploadUrl(
  ctx: ServiceContext,
  input: z.infer<typeof createDocumentUploadUrlSchema>,
) {
  const scope = await resolveScope(ctx, input);
  await enforceDocumentPermission(ctx, scope, "manage");
  validateMimeForCategory({ category: input.category, mimeType: input.mimeType });
  const safeName = sanitizeFileName(input.filename);
  const objectId = randomUUID();
  const storageKey = scope.clinicId
    ? `org/${scope.organizationId}/clinic/${scope.clinicId}/documents/${objectId}-${safeName}`
    : `org/${scope.organizationId}/documents/${objectId}-${safeName}`;

  const uploadUrl = await createSignedUploadUrl({
    storageKey,
    mimeType: input.mimeType,
    checksumSha256: input.checksumSha256?.toLowerCase(),
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: scope.organizationId, clinicId: scope.clinicId ?? undefined },
    action: "UPLOAD_REQUESTED",
    entityType: "Document",
    entityId: objectId,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
    metadata: {
      category: input.category,
      mimeType: input.mimeType,
      fileSize: input.size,
    },
  });

  logger.info("Document upload URL requested", {
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
  });

  return {
    uploadUrl,
    storageKey,
    maxSize: DOCUMENT_MAX_UPLOAD_BYTES,
    requiredHeaders: input.checksumSha256
      ? {
          "Content-Type": input.mimeType,
          "x-amz-meta-sha256": input.checksumSha256.toLowerCase(),
        }
      : { "Content-Type": input.mimeType },
  };
}

export async function finalizeDocumentUpload(
  ctx: ServiceContext,
  input: z.infer<typeof finalizeDocumentUploadSchema>,
) {
  const scope = await resolveScope(ctx, input);
  await enforceDocumentPermission(ctx, scope, "manage");
  validateMimeForCategory({ category: input.category, mimeType: input.mimeType });
  ensureStorageKeyInScope({
    storageKey: input.storageKey,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
  });

  let object: Awaited<ReturnType<typeof verifyObjectExists>>;
  try {
    object = await verifyObjectExists({ storageKey: input.storageKey });
  } catch {
    logger.warn("Document finalize failed: uploaded object missing");
    throw new AppError("Uploaded object not found. Request a new upload URL.", "VALIDATION_ERROR", 400, {
      code: "UPLOADED_OBJECT_NOT_FOUND",
    });
  }
  if (!object.contentLength || object.contentLength <= 0) {
    await cleanupOrphanedObject(input.storageKey);
    logger.warn("Document finalize failed: empty object");
    throw new AppError("Uploaded object is empty or missing", "VALIDATION_ERROR", 400);
  }
  if (object.contentLength > DOCUMENT_MAX_UPLOAD_BYTES) {
    await cleanupOrphanedObject(input.storageKey);
    logger.warn("Document finalize failed: object exceeds max size");
    throw new AppError("Uploaded object exceeds max size", "VALIDATION_ERROR", 400);
  }
  if (object.contentLength !== input.fileSize) {
    await cleanupOrphanedObject(input.storageKey);
    logger.warn("Document finalize integrity failure: size mismatch");
    throw new AppError("Uploaded object size does not match expected size", "VALIDATION_ERROR", 400);
  }
  if (
    object.contentType &&
    object.contentType !== input.mimeType &&
    !object.contentType.startsWith(`${input.mimeType};`)
  ) {
    await cleanupOrphanedObject(input.storageKey);
    logger.warn("Document finalize integrity failure: mime mismatch");
    throw new AppError("Uploaded object MIME type mismatch", "VALIDATION_ERROR", 400);
  }
  if (input.checksumSha256) {
    const actual = object.metadata?.sha256?.toLowerCase();
    const expected = input.checksumSha256.toLowerCase();
    if (!actual || actual !== expected) {
      await cleanupOrphanedObject(input.storageKey);
      logger.warn("Document finalize integrity failure: checksum mismatch");
      throw new AppError("Uploaded object checksum mismatch", "VALIDATION_ERROR", 400, {
        code: "CHECKSUM_MISMATCH",
      });
    }
  }

  const doc = await createDocument(ctx, {
    organizationId: scope.organizationId,
    clinicId: scope.clinicId ?? undefined,
    category: input.category,
    title: input.title,
    storageKey: input.storageKey,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
  });

  if (input.workflowParent) {
    await attachDocumentToParent(
      ctx,
      {
        organizationId: scope.organizationId,
        clinicId: scope.clinicId ?? undefined,
        parentType: input.workflowParent.parentType,
        parentId: input.workflowParent.parentId,
        documentId: doc.id,
      },
      { permission: Permissions.documents.manage },
    );
  }

  await writeAuditLog({
    ctx: { ...ctx, organizationId: scope.organizationId, clinicId: scope.clinicId ?? undefined },
    action: "UPLOAD_FINALIZED",
    entityType: "Document",
    entityId: doc.id,
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
    metadata: {
      category: doc.category,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      attachedToParent: Boolean(input.workflowParent),
    },
  });

  logger.info("Document upload finalized", {
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
  });

  return doc;
}

export async function getDocumentDownloadUrl(ctx: ServiceContext, documentId: string) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      clinicId: true,
      organizationId: true,
      storageKey: true,
      title: true,
      mimeType: true,
      fileSize: true,
    },
  });
  if (!document) throw new AppError("Document not found", "NOT_FOUND", 404);

  const hasClinicAccess = document.clinicId
    ? access.accessibleClinicIds.includes(document.clinicId)
    : false;
  const hasOrgAccess = document.organizationId
    ? access.accessibleOrganizationIds.includes(document.organizationId)
    : false;
  const isGlobal = access.globalRoleKeys.length > 0;

  if (!isGlobal && !hasClinicAccess && !hasOrgAccess) {
    logger.warn("Document download access denied");
    throw new AppError("Document not accessible", "UNAUTHORIZED", 403);
  }

  const permissionOrganizationId =
    document.organizationId ??
    (document.clinicId
      ? (
          await prisma.clinic.findUnique({
            where: { id: document.clinicId },
            select: { organizationId: true },
          })
        )?.organizationId
      : null);
  if (!permissionOrganizationId) {
    throw new AppError("Document is missing tenant scope", "VALIDATION_ERROR", 400);
  }

  await enforceDocumentPermission(
    ctx,
    {
      organizationId: permissionOrganizationId,
      clinicId: document.clinicId ?? null,
    },
    "read",
  );

  const downloadUrl = await createSignedDownloadUrl({
    storageKey: document.storageKey,
  });

  await writeAuditLog({
    ctx,
    action: "DOWNLOAD_REQUESTED",
    entityType: "Document",
    entityId: document.id,
    organizationId: document.organizationId,
    clinicId: document.clinicId,
    metadata: {
      mimeType: document.mimeType,
      fileSize: document.fileSize,
    },
  });

  logger.info("Document download URL requested", {
    organizationId: document.organizationId,
    clinicId: document.clinicId,
  });

  return {
    downloadUrl,
    fileName: document.title,
    mimeType: document.mimeType,
    expiresInSeconds: 120,
  };
}

export async function attachDocumentForWorkflowParent(
  ctx: ServiceContext,
  input: z.infer<typeof attachDocumentForWorkflowSchema>,
) {
  const scope = await resolveScope(ctx, input);

  const attachment = await attachDocumentToParent(
    ctx,
    {
      organizationId: scope.organizationId,
      clinicId: scope.clinicId ?? undefined,
      parentType: input.parentType,
      parentId: input.parentId,
      documentId: input.documentId,
    },
    { permission: Permissions.documents.manage },
  );

  logger.info("Document attached to workflow parent", {
    organizationId: scope.organizationId,
    clinicId: scope.clinicId,
  });

  return attachment;
}

