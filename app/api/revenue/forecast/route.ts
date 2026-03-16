import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { forecastExpectedReimbursement } from "@/server/services/analytics/revenue-optimization.service";
import { forecastRevenueSchema } from "@/server/services/analytics/revenue-optimization.schemas";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = forecastRevenueSchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      payerName: url.searchParams.get("payerName") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    return forecastExpectedReimbursement(
      { actorUserId: userId, organizationId: parsed.organizationId, clinicId: parsed.clinicId },
      {
        organizationId: parsed.organizationId,
        clinicId: parsed.clinicId,
        payerName: parsed.payerName,
        limit: parsed.limit,
      },
    );
  });
}
