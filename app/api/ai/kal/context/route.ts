import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { buildKalContext } from "@/server/services/ai/kal-context.service";
import { kalContextSchema } from "@/server/services/ai/kal.schemas";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = kalContextSchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      intent: url.searchParams.get("intent") ?? "general",
      query: url.searchParams.get("query") ?? undefined,
    });

    return buildKalContext(
      { actorUserId: userId, organizationId: parsed.organizationId, clinicId: parsed.clinicId },
      parsed,
    );
  });
}
