import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { getOperationalAlerts } from "@/server/services/analytics/command-center.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const organizationId = new URL(req.url).searchParams.get("organizationId") ?? undefined;
    return getOperationalAlerts({ actorUserId: userId, organizationId }, { organizationId });
  });
}
