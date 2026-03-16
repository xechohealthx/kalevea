import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  addCommentSchema,
  addTicketComment,
} from "@/server/services/support/support.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();

    const json = await req.json();
    const input = addCommentSchema.parse(json);
    const { ticketId } = await params;
    return addTicketComment({ actorUserId: userId }, ticketId, input);
  });
}

