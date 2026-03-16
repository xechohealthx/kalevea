import { z } from "zod";

import { DOCUMENT_MAX_UPLOAD_BYTES } from "@/server/services/documents/document.service";

export const eraUploadRequestSchema = z.object({
  clinicId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1).default("application/edi-x12"),
  size: z.number().int().positive().max(DOCUMENT_MAX_UPLOAD_BYTES),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  title: z.string().min(2).max(200).optional(),
});

export const eraProcessSchema = z.object({
  clinicId: z.string().min(1),
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive().max(DOCUMENT_MAX_UPLOAD_BYTES),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  title: z.string().min(2).max(200).optional(),
});
