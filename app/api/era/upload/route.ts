import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { eraUploadRequestSchema } from "@/server/services/era/era.schemas";
import { requestEraUpload } from "@/server/services/era/era.service";

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const parsed = eraUploadRequestSchema.parse(json);

    return requestEraUpload(
      { actorUserId: userId, clinicId: parsed.clinicId },
      {
        clinicId: parsed.clinicId,
        filename: parsed.filename,
        mimeType: parsed.mimeType,
        size: parsed.size,
        checksumSha256: parsed.checksumSha256,
        title: parsed.title,
      },
    );
  });
}
