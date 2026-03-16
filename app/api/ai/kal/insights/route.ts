import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { getClinicInsights, getPayerInsights, getRevenueInsights } from "@/server/services/ai/kal-insight.service";
import { kalInsightsSchema } from "@/server/services/ai/kal.schemas";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = kalInsightsSchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const ctx = { actorUserId: userId, organizationId: parsed.organizationId, clinicId: parsed.clinicId };
    const [clinicInsights, payerInsights, revenueInsights] = await Promise.all([
      getClinicInsights(ctx, parsed),
      getPayerInsights(ctx, parsed),
      getRevenueInsights(ctx, parsed),
    ]);
    return { clinicInsights, payerInsights, revenueInsights };
  });
}
