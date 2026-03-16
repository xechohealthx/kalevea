import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  generateRevenueOptimizationSignals,
  listRevenueOptimizationSignals,
} from "@/server/services/analytics/revenue-optimization.service";
import { listRevenueSignalsSchema } from "@/server/services/analytics/revenue-optimization.schemas";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = listRevenueSignalsSchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      signalType: url.searchParams.get("signalType") ?? undefined,
      signalSeverity: url.searchParams.get("signalSeverity") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      refresh: url.searchParams.get("refresh") ?? undefined,
    });

    if (parsed.refresh) {
      await generateRevenueOptimizationSignals(
        { actorUserId: userId, organizationId: parsed.organizationId, clinicId: parsed.clinicId },
        { organizationId: parsed.organizationId, clinicId: parsed.clinicId },
      );
    }

    return listRevenueOptimizationSignals(
      { actorUserId: userId, organizationId: parsed.organizationId, clinicId: parsed.clinicId },
      {
        organizationId: parsed.organizationId,
        clinicId: parsed.clinicId,
        signalType: parsed.signalType,
        signalSeverity: parsed.signalSeverity,
        limit: parsed.limit,
      },
    );
  });
}
