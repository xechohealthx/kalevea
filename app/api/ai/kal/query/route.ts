import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { askKal } from "@/server/services/ai/kal-assistant.service";
import { kalQuerySchema } from "@/server/services/ai/kal.schemas";

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const parsed = kalQuerySchema.parse(json);

    return askKal(
      {
        actorUserId: userId,
        organizationId: parsed.organizationId,
        clinicId: parsed.clinicId,
      },
      {
        query: parsed.query,
        organizationId: parsed.organizationId,
        clinicId: parsed.clinicId,
        intent: parsed.intent,
        includeContext: parsed.includeContext,
      },
    );
  });
}
