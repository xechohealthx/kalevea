import { NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";
import { AppError } from "@/lib/utils";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  createTicket,
  createTicketSchema,
  listTickets,
  ticketFilterSchema,
} from "@/server/services/support/support.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new AppError("Authentication required", "UNAUTHENTICATED", 401);

    const url = new URL(req.url);
    const filter = ticketFilterSchema.parse({
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      priority: url.searchParams.get("priority") ?? undefined,
    });

    return listTickets({ actorUserId: userId }, filter);
  });
}

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new AppError("Authentication required", "UNAUTHENTICATED", 401);

    const json = await req.json();
    const input = createTicketSchema.parse(json);
    return createTicket({ actorUserId: userId, clinicId: input.clinicId }, input);
  });
}

