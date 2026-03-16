import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { getPayerBenchmarkSummary } from "@/server/services/analytics/network-benchmark.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const organizationId = url.searchParams.get("organizationId") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    return getPayerBenchmarkSummary({ actorUserId: userId, organizationId }, { organizationId, limit });
  });
}
