import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  attachDocumentForWorkflowParent,
  attachDocumentForWorkflowSchema,
} from "@/server/services/documents/document.service";

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const input = attachDocumentForWorkflowSchema.parse(json);
    return attachDocumentForWorkflowParent({ actorUserId: userId }, input);
  });
}
