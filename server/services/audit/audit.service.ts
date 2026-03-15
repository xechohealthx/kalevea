import { prisma } from "@/lib/db/prisma";
import type { ServiceContext } from "@/server/services/service-context";
import type { Prisma } from "@prisma/client";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "SEED" | string;

export async function writeAuditLog(input: {
  ctx: ServiceContext;
  action: AuditAction;
  entityType: string;
  entityId: string;
  organizationId?: string | null;
  clinicId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  const { ctx, action, entityType, entityId, organizationId, clinicId, metadata } = input;

  // Never include PHI in metadata. Keep metadata operational.
  return prisma.auditLog.create({
    data: {
      organizationId: organizationId ?? ctx.organizationId ?? null,
      clinicId: clinicId ?? ctx.clinicId ?? null,
      actorUserId: ctx.actorUserId ?? null,
      action,
      entityType,
      entityId,
      metadata: metadata ?? undefined,
    },
  });
}

