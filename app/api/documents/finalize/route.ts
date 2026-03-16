import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  finalizeDocumentUpload,
  finalizeDocumentUploadSchema,
} from "@/server/services/documents/document.service";

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const input = finalizeDocumentUploadSchema.parse(json);
    return finalizeDocumentUpload({ actorUserId: userId }, input);
  });
}
