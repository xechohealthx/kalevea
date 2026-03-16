import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  createDocument,
  createDocumentSchema,
  documentFilterSchema,
  listDocuments,
} from "@/server/services/documents/document.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();

    const url = new URL(req.url);
    const filter = documentFilterSchema.parse({
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
    });

    return listDocuments({ actorUserId: userId }, filter);
  });
}

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();

    const json = await req.json();
    const input = createDocumentSchema.parse(json);
    return createDocument({ actorUserId: userId }, input);
  });
}

