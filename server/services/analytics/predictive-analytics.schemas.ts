import { z } from "zod";

export const predictiveQuerySchema = z.object({
  organizationId: z.string().min(1).optional(),
  clinicId: z.string().min(1).optional(),
  refresh: z.coerce.boolean().optional().default(false),
});
