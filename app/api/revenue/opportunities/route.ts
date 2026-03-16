import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { getRevenueOpportunities } from "@/server/services/analytics/revenue-optimization.service";
import { revenueOpportunitiesSchema } from "@/server/services/analytics/revenue-optimization.schemas";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = revenueOpportunitiesSchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    return getRevenueOpportunities(
      { actorUserId: userId, organizationId: parsed.organizationId, clinicId: parsed.clinicId },
      {
        organizationId: parsed.organizationId,
        clinicId: parsed.clinicId,
        limit: parsed.limit,
      },
    );
  });
}
