import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  generatePredictiveSignals,
  listPredictiveSignals,
  predictPayerVarianceTrend,
  predictUnderpaymentRisk,
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
    const [underpaymentRisk, varianceTrend, signals] = await Promise.all([
      predictUnderpaymentRisk(ctx, parsed),
      predictPayerVarianceTrend(ctx, parsed),
      listPredictiveSignals(ctx, {
        organizationId: parsed.organizationId,
        clinicId: parsed.clinicId,
        signalType: "UNDERPAYMENT_RISK",
        limit: 50,
      }),
    ]);
    return { underpaymentRisk, varianceTrend, signals };
  });
}
