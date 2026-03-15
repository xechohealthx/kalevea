import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import type { Permission } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import type { ServiceContext } from "@/server/services/service-context";

import type { AttachDocumentInput, CreateNoteInput, CreateTaskInput, ParentRef } from "./workflow.types";

async function enforceTenant(ctx: ServiceContext, parent: ParentRef) {
  const access = await getAccessSnapshot(ctx.actorUserId);

  if (access.globalRoleKeys.length > 0) return;

  if (parent.clinicId) {
    if (!access.accessibleClinicIds.includes(parent.clinicId)) {
      throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
    }
    return;
  }

  if (!access.accessibleOrganizationIds.includes(parent.organizationId)) {
    throw new AppError("Organization not accessible", "UNAUTHORIZED", 403);
  }
}

async function enforcePermission(
  ctx: ServiceContext,
  parent: ParentRef,
  permission?: Permission,
) {
  if (!permission) return;
  if (parent.clinicId) {
    await requirePermission(ctx.actorUserId, permission, { scope: "CLINIC", clinicId: parent.clinicId });
    return;
  }
  await requirePermission(ctx.actorUserId, permission, { scope: "ORGANIZATION", organizationId: parent.organizationId });
}

export async function listNotesForParent(ctx: ServiceContext, parent: ParentRef) {
  await enforceTenant(ctx, parent);

  return prisma.note.findMany({
    where: {
      organizationId: parent.organizationId,
      clinicId: parent.clinicId ?? null,
      parentType: parent.parentType,
      parentId: parent.parentId,
    },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function createNote(
  ctx: ServiceContext,
  input: CreateNoteInput,
  options?: { permission?: Permission },
) {
  await enforceTenant(ctx, input);
  await enforcePermission(ctx, input, options?.permission);

  const note = await prisma.note.create({
    data: {
      organizationId: input.organizationId,
      clinicId: input.clinicId ?? null,
      parentType: input.parentType,
      parentId: input.parentId,
      body: input.body,
      createdById: ctx.actorUserId,
    },
  });

  await prisma.activityEvent.create({
    data: {
      organizationId: input.organizationId,
      clinicId: input.clinicId ?? null,
      parentType: input.parentType,
      parentId: input.parentId,
      type: "NOTE_CREATED",
      title: "Note added",
      description: input.body.length > 180 ? `${input.body.slice(0, 180)}…` : input.body,
      createdById: ctx.actorUserId,
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: input.organizationId, clinicId: input.clinicId ?? undefined },
    action: "CREATE",
    entityType: "Note",
    entityId: note.id,
    organizationId: input.organizationId,
    clinicId: input.clinicId ?? null,
    metadata: { parentType: input.parentType, parentId: input.parentId },
  });

  return note;
}

export async function listTasksForParent(ctx: ServiceContext, parent: ParentRef) {
  await enforceTenant(ctx, parent);

  return prisma.workTask.findMany({
    where: {
      organizationId: parent.organizationId,
      clinicId: parent.clinicId ?? null,
      parentType: parent.parentType,
      parentId: parent.parentId,
    },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function createTask(
  ctx: ServiceContext,
  input: CreateTaskInput,
  options?: { permission?: Permission },
) {
  await enforceTenant(ctx, input);
  await enforcePermission(ctx, input, options?.permission);

  const task = await prisma.workTask.create({
    data: {
      organizationId: input.organizationId,
      clinicId: input.clinicId ?? null,
      parentType: input.parentType,
      parentId: input.parentId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "TODO",
      priority: input.priority ?? null,
      assignedToId: input.assignedToId ?? null,
      dueAt: input.dueAt ?? null,
      createdById: ctx.actorUserId,
      updatedById: ctx.actorUserId,
    },
  });

  await prisma.activityEvent.create({
    data: {
      organizationId: input.organizationId,
      clinicId: input.clinicId ?? null,
      parentType: input.parentType,
      parentId: input.parentId,
      type: "TASK_CREATED",
      title: "Task created",
      description: input.title,
      createdById: ctx.actorUserId,
      metadata: { status: task.status, priority: task.priority },
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: input.organizationId, clinicId: input.clinicId ?? undefined },
    action: "CREATE",
    entityType: "WorkTask",
    entityId: task.id,
    organizationId: input.organizationId,
    clinicId: input.clinicId ?? null,
    metadata: { parentType: input.parentType, parentId: input.parentId, status: task.status },
  });

  return task;
}

export async function updateTaskStatus(
  ctx: ServiceContext,
  taskId: string,
  input: { status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE"; note?: string | null },
  options?: { permission?: Permission },
) {
  const existing = await prisma.workTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      organizationId: true,
      clinicId: true,
      parentType: true,
      parentId: true,
      status: true,
    },
  });
  if (!existing) throw new AppError("Task not found", "NOT_FOUND", 404);

  const parent: ParentRef = {
    organizationId: existing.organizationId,
    clinicId: existing.clinicId,
    parentType: existing.parentType,
    parentId: existing.parentId,
  };
  await enforceTenant(ctx, parent);
  await enforcePermission(ctx, parent, options?.permission);

  const updated = await prisma.workTask.update({
    where: { id: taskId },
    data: {
      status: input.status,
      updatedById: ctx.actorUserId,
      completedAt: input.status === "DONE" ? new Date() : null,
    },
  });

  await prisma.statusEvent.create({
    data: {
      organizationId: existing.organizationId,
      clinicId: existing.clinicId,
      parentType: existing.parentType,
      parentId: existing.parentId,
      fromStatus: existing.status,
      toStatus: updated.status,
      note: input.note ?? null,
      changedById: ctx.actorUserId,
    },
  });

  await prisma.activityEvent.create({
    data: {
      organizationId: existing.organizationId,
      clinicId: existing.clinicId,
      parentType: existing.parentType,
      parentId: existing.parentId,
      type: "TASK_STATUS_UPDATED",
      title: "Task status updated",
      description: `${existing.status} → ${updated.status}`,
      createdById: ctx.actorUserId,
      metadata: { fromStatus: existing.status, toStatus: updated.status },
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: existing.organizationId, clinicId: existing.clinicId ?? undefined },
    action: "UPDATE",
    entityType: "WorkTask",
    entityId: updated.id,
    organizationId: existing.organizationId,
    clinicId: existing.clinicId,
    metadata: { fromStatus: existing.status, toStatus: updated.status },
  });

  return updated;
}

export async function listActivityForParent(ctx: ServiceContext, parent: ParentRef) {
  await enforceTenant(ctx, parent);
  return prisma.activityEvent.findMany({
    where: {
      organizationId: parent.organizationId,
      clinicId: parent.clinicId ?? null,
      parentType: parent.parentType,
      parentId: parent.parentId,
    },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
}

export async function createStatusEvent(
  ctx: ServiceContext,
  input: ParentRef & {
    fromStatus?: string | null;
    toStatus: string;
    note?: string | null;
  },
  options?: { permission?: Permission },
) {
  await enforceTenant(ctx, input);
  await enforcePermission(ctx, input, options?.permission);

  const event = await prisma.statusEvent.create({
    data: {
      organizationId: input.organizationId,
      clinicId: input.clinicId ?? null,
      parentType: input.parentType,
      parentId: input.parentId,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      note: input.note ?? null,
      changedById: ctx.actorUserId,
    },
  });

  await prisma.activityEvent.create({
    data: {
      organizationId: input.organizationId,
      clinicId: input.clinicId ?? null,
      parentType: input.parentType,
      parentId: input.parentId,
      type: "STATUS_CHANGED",
      title: "Status changed",
      description: input.fromStatus ? `${input.fromStatus} → ${input.toStatus}` : input.toStatus,
      createdById: ctx.actorUserId,
      metadata: { fromStatus: input.fromStatus ?? null, toStatus: input.toStatus },
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: input.organizationId, clinicId: input.clinicId ?? undefined },
    action: "CREATE",
    entityType: "StatusEvent",
    entityId: event.id,
    organizationId: input.organizationId,
    clinicId: input.clinicId ?? null,
    metadata: { parentType: input.parentType, parentId: input.parentId, toStatus: input.toStatus },
  });

  return event;
}

export async function attachDocumentToParent(
  ctx: ServiceContext,
  input: AttachDocumentInput,
  options?: { permission?: Permission },
) {
  await enforceTenant(ctx, input);
  await enforcePermission(ctx, input, options?.permission);

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    select: { id: true, organizationId: true, clinicId: true, title: true },
  });
  if (!doc) throw new AppError("Document not found", "NOT_FOUND", 404);

  const docScopedOk =
    (doc.clinicId && input.clinicId && doc.clinicId === input.clinicId) ||
    (doc.organizationId && doc.organizationId === input.organizationId) ||
    (doc.clinicId === null && doc.organizationId === null);

  if (!docScopedOk) {
    throw new AppError("Document not accessible for this parent", "UNAUTHORIZED", 403);
  }

  const attachment = await prisma.fileAttachment.create({
    data: {
      organizationId: input.organizationId,
      clinicId: input.clinicId ?? null,
      parentType: input.parentType,
      parentId: input.parentId,
      documentId: input.documentId,
      createdById: ctx.actorUserId,
    },
  });

  await prisma.activityEvent.create({
    data: {
      organizationId: input.organizationId,
      clinicId: input.clinicId ?? null,
      parentType: input.parentType,
      parentId: input.parentId,
      type: "DOCUMENT_ATTACHED",
      title: "Document attached",
      description: doc.title,
      createdById: ctx.actorUserId,
      metadata: { documentId: doc.id },
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: input.organizationId, clinicId: input.clinicId ?? undefined },
    action: "CREATE",
    entityType: "FileAttachment",
    entityId: attachment.id,
    organizationId: input.organizationId,
    clinicId: input.clinicId ?? null,
    metadata: { parentType: input.parentType, parentId: input.parentId, documentId: input.documentId },
  });

  return attachment;
}

