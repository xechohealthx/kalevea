import type { WorkTaskPriority, WorkTaskStatus } from "@prisma/client";

export type ParentRef = {
  organizationId: string;
  clinicId?: string | null;
  parentType: string;
  parentId: string;
};

export type CreateNoteInput = ParentRef & {
  body: string;
};

export type CreateTaskInput = ParentRef & {
  title: string;
  description?: string | null;
  status?: WorkTaskStatus;
  priority?: WorkTaskPriority | null;
  assignedToId?: string | null;
  dueAt?: Date | null;
};

export type AttachDocumentInput = ParentRef & {
  documentId: string;
};

