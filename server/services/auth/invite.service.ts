import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { requirePermission } from "@/lib/rbac/check";
import { Permissions } from "@/lib/rbac/permissions";
import { AppError } from "@/lib/utils/errors";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import type { ServiceContext } from "@/server/services/service-context";

async function requireIdentityPermission(
  ctx: ServiceContext,
  permission: "read" | "manage",
  organizationId: string,
) {
  try {
    await requirePermission(
      ctx.actorUserId,
      permission === "read" ? Permissions.identity.read : Permissions.identity.manage,
      {
        scope: "ORGANIZATION",
        organizationId,
      },
    );
  } catch (error) {
    logger.warn("Identity admin permission denied", { organizationId, permission });
    throw error;
  }
}

export const listMembersAndInvitesSchema = z.object({
  organizationId: z.string().min(1),
});

export const createInviteSchema = z
  .object({
    email: z.string().email(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    organizationId: z.string().min(1),
    clinicId: z.string().min(1).optional(),
    roleKey: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.clinicId && !value.organizationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organizationId"],
        message: "organizationId is required when clinicId is provided",
      });
    }
  });

export const revokeInviteSchema = z.object({
  inviteId: z.string().min(1),
  organizationId: z.string().min(1),
});

export const resendInviteSchema = z.object({
  inviteId: z.string().min(1),
  organizationId: z.string().min(1),
});

export async function listMembersAndInvites(
  ctx: ServiceContext,
  input: z.infer<typeof listMembersAndInvitesSchema>,
) {
  await requireIdentityPermission(ctx, "read", input.organizationId);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { orgRoles: { some: { organizationId: input.organizationId } } },
        { clinicRoles: { some: { clinic: { organizationId: input.organizationId } } } },
      ],
    },
    orderBy: [{ invitationStatus: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      invitationStatus: true,
      authProviderType: true,
      invitedAt: true,
      acceptedAt: true,
      orgRoles: {
        where: { organizationId: input.organizationId },
        select: { role: { select: { key: true, name: true } } },
      },
      clinicRoles: {
        where: { clinic: { organizationId: input.organizationId } },
        select: {
          role: { select: { key: true, name: true } },
          clinic: { select: { id: true, name: true } },
        },
      },
    },
  });

  return users.map((user) => {
    const clinicsById = new Map<
      string,
      { clinicId: string; clinicName: string; roleKeys: string[]; roleNames: string[] }
    >();
    for (const role of user.clinicRoles) {
      const existing = clinicsById.get(role.clinic.id);
      if (existing) {
        existing.roleKeys.push(role.role.key);
        existing.roleNames.push(role.role.name);
      } else {
        clinicsById.set(role.clinic.id, {
          clinicId: role.clinic.id,
          clinicName: role.clinic.name,
          roleKeys: [role.role.key],
          roleNames: [role.role.name],
        });
      }
    }

    return {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      invitationStatus: user.invitationStatus,
      authProviderType: user.authProviderType ?? null,
      isActive: user.isActive,
      organizationRoles: user.orgRoles.map((r) => ({
        roleKey: r.role.key,
        roleName: r.role.name,
      })),
      clinicScopes: [...clinicsById.values()],
      invitedAt: user.invitedAt,
      acceptedAt: user.acceptedAt,
    };
  });
}

export async function createInvite(
  ctx: ServiceContext,
  input: z.infer<typeof createInviteSchema>,
) {
  await requireIdentityPermission(ctx, "manage", input.organizationId);

  const role = await prisma.role.findUnique({
    where: { key: input.roleKey },
    select: { id: true, key: true, scope: true },
  });
  if (!role) throw new AppError("Role not found", "NOT_FOUND", 404);
  if (role.scope === "GLOBAL") {
    throw new AppError("Global role invites are not supported in this flow", "UNAUTHORIZED", 403);
  }
  if (role.scope === "CLINIC" && !input.clinicId) {
    throw new AppError("clinicId is required for clinic roles", "VALIDATION_ERROR", 400);
  }
  if (role.scope === "CLINIC" && input.clinicId) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: input.clinicId },
      select: { organizationId: true },
    });
    if (!clinic || clinic.organizationId !== input.organizationId) {
      throw new AppError("Clinic does not belong to organization", "VALIDATION_ERROR", 400);
    }
  }

  const now = new Date();
  const [localPart] = input.email.split("@");
  const fallbackName = localPart.replace(/[^a-zA-Z0-9]/g, " ").trim() || "Invited User";

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      invitationStatus: "PENDING",
      invitedAt: now,
      acceptedAt: null,
      isActive: false,
    },
    create: {
      email: input.email,
      firstName: input.firstName ?? fallbackName,
      lastName: input.lastName ?? "Pending",
      isActive: false,
      invitationStatus: "PENDING",
      invitedAt: now,
    },
    select: { id: true, email: true, invitationStatus: true },
  });

  if (role.scope === "ORGANIZATION") {
    await prisma.userOrganizationRole.createMany({
      data: [{ userId: user.id, organizationId: input.organizationId!, roleId: role.id }],
      skipDuplicates: true,
    });
  }
  if (role.scope === "CLINIC") {
    await prisma.userClinicRole.createMany({
      data: [{ userId: user.id, clinicId: input.clinicId!, roleId: role.id }],
      skipDuplicates: true,
    });
  }

  await writeAuditLog({
    ctx,
    action: "INVITE_CREATE",
    entityType: "UserInvite",
    entityId: user.id,
    organizationId: input.organizationId ?? undefined,
    clinicId: input.clinicId ?? undefined,
    metadata: {
      roleKey: role.key,
      scope: role.scope,
      // TODO(phase-2b): issue signed invite token and send transactional email.
    },
  });
  logger.info("Invite created", { organizationId: input.organizationId, clinicId: input.clinicId ?? null });

  return {
    inviteId: user.id,
    userId: user.id,
    email: user.email,
    invitationStatus: user.invitationStatus,
    roleKey: role.key,
    scope: role.scope,
    organizationId: input.organizationId ?? null,
    clinicId: input.clinicId ?? null,
  };
}

export async function acceptPendingInviteForAuthenticatedUser(
  ctx: ServiceContext,
  input: { userId: string },
) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, invitationStatus: true },
  });
  if (!user) throw new AppError("User not found", "NOT_FOUND", 404);
  if (user.invitationStatus === "REVOKED") {
    logger.warn("Invite acceptance blocked for revoked invite", { userId: input.userId });
    throw new AppError("Invite was revoked", "UNAUTHORIZED", 403);
  }

  if (user.invitationStatus === "PENDING") {
    await prisma.user.update({
      where: { id: input.userId },
      data: {
        invitationStatus: "ACCEPTED",
        acceptedAt: new Date(),
        isActive: true,
      },
    });
    await writeAuditLog({
      ctx,
      action: "INVITE_ACCEPT",
      entityType: "UserInvite",
      entityId: input.userId,
      metadata: { accepted: true },
    });
    logger.info("Invite accepted", { userId: input.userId });
  }

  return { ok: true };
}

export async function revokeInvite(
  ctx: ServiceContext,
  input: z.infer<typeof revokeInviteSchema>,
) {
  await requireIdentityPermission(ctx, "manage", input.organizationId);

  const user = await prisma.user.findUnique({
    where: { id: input.inviteId },
    select: { id: true, invitationStatus: true, email: true },
  });
  if (!user) throw new AppError("Invite not found", "NOT_FOUND", 404);
  if (user.invitationStatus !== "PENDING") {
    throw new AppError("Only pending invites can be revoked", "VALIDATION_ERROR", 400);
  }

  await prisma.user.update({
    where: { id: input.inviteId },
    data: {
      invitationStatus: "REVOKED",
      isActive: false,
    },
  });

  await writeAuditLog({
    ctx,
    action: "INVITE_REVOKE",
    entityType: "UserInvite",
    entityId: input.inviteId,
    organizationId: input.organizationId,
    metadata: { revoked: true },
  });
  logger.info("Invite revoked", { organizationId: input.organizationId });

  return {
    inviteId: input.inviteId,
    invitationStatus: "REVOKED" as const,
  };
}

export async function resendInvite(
  ctx: ServiceContext,
  input: z.infer<typeof resendInviteSchema>,
) {
  await requireIdentityPermission(ctx, "manage", input.organizationId);

  const user = await prisma.user.findUnique({
    where: { id: input.inviteId },
    select: { id: true, invitationStatus: true },
  });
  if (!user) throw new AppError("Invite not found", "NOT_FOUND", 404);
  if (user.invitationStatus !== "PENDING") {
    throw new AppError("Only pending invites can be resent", "VALIDATION_ERROR", 400);
  }

  const invitedAt = new Date();
  await prisma.user.update({
    where: { id: input.inviteId },
    data: { invitedAt },
  });

  await writeAuditLog({
    ctx,
    action: "INVITE_RESEND",
    entityType: "UserInvite",
    entityId: input.inviteId,
    organizationId: input.organizationId,
    metadata: {
      // TODO(phase-2b): send external email using signed invite token.
      resent: true,
    },
  });
  logger.info("Invite resent", { organizationId: input.organizationId });

  return {
    inviteId: input.inviteId,
    resent: true,
    invitedAt,
  };
}
