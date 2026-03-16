import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  generatePredictiveSignals,
  listPredictiveSignals,
  predictExpectedRevenue,
} from "@/server/services/analytics/predictive-analytics.service";
import { predictiveQuerySchema } from "@/server/services/analytics/predictive-analytics.schemas";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = predictiveQuerySchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      refresh: url.searchParams.get("refresh") ?? undefined,
    });
    const ctx = { actorUserId: userId, organizationId: parsed.organizationId, clinicId: parsed.clinicId };

    if (parsed.refresh) {
      await generatePredictiveSignals(ctx, parsed);
    }

    const [forecast, signals] = await Promise.all([
      predictExpectedRevenue(ctx, parsed),
      listPredictiveSignals(ctx, {
        organizationId: parsed.organizationId,
        clinicId: parsed.clinicId,
        signalType: "REVENUE_FORECAST",
        limit: 20,
      }),
    ]);
    return { forecast, signals };
  });
}
