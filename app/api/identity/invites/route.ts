import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { createInvite, createInviteSchema } from "@/server/services/auth/invite.service";

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const input = createInviteSchema.parse(json);
    return createInvite({ actorUserId: userId, organizationId: input.organizationId }, input);
  });
}
