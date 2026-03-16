import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  listMembersAndInvites,
  listMembersAndInvitesSchema,
} from "@/server/services/auth/invite.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);

    const input = listMembersAndInvitesSchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? "",
    });

    return listMembersAndInvites({ actorUserId: userId, organizationId: input.organizationId }, input);
  });
}
