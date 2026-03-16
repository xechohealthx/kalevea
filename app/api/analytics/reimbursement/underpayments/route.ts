import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { listUnderpaidCases } from "@/server/services/analytics/reimbursement-analytics.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const clinicId = url.searchParams.get("clinicId") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    return listUnderpaidCases({ actorUserId: userId }, { clinicId, limit });
  });
}
