import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { generateOperationalActions } from "@/server/services/ai/kal-action-recommendation.service";
import { kalRecommendationsSchema } from "@/server/services/ai/kal.schemas";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = kalRecommendationsSchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    return generateOperationalActions(
      { actorUserId: userId, organizationId: parsed.organizationId, clinicId: parsed.clinicId },
      parsed,
    );
  });
}
