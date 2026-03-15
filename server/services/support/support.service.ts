import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/utils";
import type { Prisma } from "@prisma/client";
import type { ServiceContext } from "@/server/services/service-context";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { writeAuditLog } from "@/server/services/audit/audit.service";

export const ticketFilterSchema = z.object({
  clinicId: z.string().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

export const createTicketSchema = z.object({
  clinicId: z.string().min(1),
  category: z.enum(["BILLING", "PA", "TRAINING", "COMPLIANCE", "TECHNICAL", "GENERAL"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  subject: z.string().min(3),
  description: z.string().min(5),
});

export const addCommentSchema = z.object({
  body: z.string().min(1),
  isInternal: z.boolean().optional(),
});

export async function listTickets(ctx: ServiceContext, filter: z.infer<typeof ticketFilterSchema>) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const clinicIds = filter.clinicId ? [filter.clinicId] : access.accessibleClinicIds;
  for (const cid of clinicIds) {
    if (!access.accessibleClinicIds.includes(cid)) {
      throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
    }
  }

  const where: Prisma.SupportTicketWhereInput = { clinicId: { in: clinicIds } };
  if (filter.status) where.status = filter.status;
  if (filter.priority) where.priority = filter.priority;

  return prisma.supportTicket.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: {
      clinic: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { comments: true } },
    },
  });
}

export async function createTicket(ctx: ServiceContext, input: z.infer<typeof createTicketSchema>) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  if (!access.accessibleClinicIds.includes(input.clinicId)) {
    throw new AppError("Clinic not accessible", "UNAUTHORIZED", 403);
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      clinicId: input.clinicId,
      createdByUserId: ctx.actorUserId,
      category: input.category,
      priority: input.priority ?? "MEDIUM",
      status: "OPEN",
      subject: input.subject,
      description: input.description,
    },
  });

  await writeAuditLog({
    ctx: { ...ctx, clinicId: input.clinicId },
    action: "CREATE",
    entityType: "SupportTicket",
    entityId: ticket.id,
    clinicId: input.clinicId,
    metadata: { category: ticket.category, priority: ticket.priority },
  });

  return ticket;
}

export async function getTicket(ctx: ServiceContext, ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      clinic: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      comments: {
        orderBy: [{ createdAt: "asc" }],
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
  });

  if (!ticket) throw new AppError("Ticket not found", "NOT_FOUND", 404);

  const access = await getAccessSnapshot(ctx.actorUserId);
  if (!access.accessibleClinicIds.includes(ticket.clinicId)) {
    throw new AppError("Ticket not accessible", "UNAUTHORIZED", 403);
  }

  return ticket;
}

export async function addTicketComment(
  ctx: ServiceContext,
  ticketId: string,
  input: z.infer<typeof addCommentSchema>,
) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, clinicId: true },
  });
  if (!ticket) throw new AppError("Ticket not found", "NOT_FOUND", 404);

  const access = await getAccessSnapshot(ctx.actorUserId);
  if (!access.accessibleClinicIds.includes(ticket.clinicId)) {
    throw new AppError("Ticket not accessible", "UNAUTHORIZED", 403);
  }

  const comment = await prisma.supportTicketComment.create({
    data: {
      ticketId,
      userId: ctx.actorUserId,
      body: input.body,
      isInternal: input.isInternal ?? false,
    },
  });

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });

  await writeAuditLog({
    ctx: { ...ctx, clinicId: ticket.clinicId },
    action: "CREATE",
    entityType: "SupportTicketComment",
    entityId: comment.id,
    clinicId: ticket.clinicId,
    metadata: { ticketId, isInternal: comment.isInternal },
  });

  return comment;
}

