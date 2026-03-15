import { z } from "zod";

export const parentRefSchema = z.object({
  organizationId: z.string().min(1),
  clinicId: z.string().nullable().optional(),
  parentType: z.string().min(1),
  parentId: z.string().min(1),
});

export const createNoteSchema = parentRefSchema.extend({
  body: z.string().min(1),
});

export const listParentSchema = parentRefSchema.pick({
  organizationId: true,
  clinicId: true,
  parentType: true,
  parentId: true,
});

export const createTaskSchema = parentRefSchema.extend({
  title: z.string().min(2),
  description: z.string().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]),
  note: z.string().nullable().optional(),
});

export const attachDocumentSchema = parentRefSchema.extend({
  documentId: z.string().min(1),
});

