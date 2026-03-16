import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { getDocumentDownloadUrl } from "@/server/services/documents/document.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { documentId } = await params;
    return getDocumentDownloadUrl({ actorUserId: userId }, documentId);
  });
}
