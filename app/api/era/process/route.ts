import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { eraProcessSchema } from "@/server/services/era/era.schemas";
import { processEraUpload } from "@/server/services/era/era.service";

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const parsed = eraProcessSchema.parse(json);

    return processEraUpload(
      { actorUserId: userId, clinicId: parsed.clinicId },
      {
        clinicId: parsed.clinicId,
        storageKey: parsed.storageKey,
        mimeType: parsed.mimeType,
        fileSize: parsed.fileSize,
        checksumSha256: parsed.checksumSha256,
        title: parsed.title,
      },
    );
  });
}
