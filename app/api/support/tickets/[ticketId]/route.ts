import { NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";
import { AppError } from "@/lib/utils";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { getTicket } from "@/server/services/support/support.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new AppError("Authentication required", "UNAUTHENTICATED", 401);

    const { ticketId } = await params;
    return getTicket({ actorUserId: userId }, ticketId);
  });
}

