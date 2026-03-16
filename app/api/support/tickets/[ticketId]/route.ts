import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { getTicket } from "@/server/services/support/support.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();

    const { ticketId } = await params;
    return getTicket({ actorUserId: userId }, ticketId);
  });
}

