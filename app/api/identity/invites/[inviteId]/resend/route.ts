import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { resendInvite, resendInviteSchema } from "@/server/services/auth/invite.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { inviteId } = await params;
    const json = await req.json();

    const input = resendInviteSchema.parse({
      inviteId,
      organizationId: json.organizationId,
    });

    return resendInvite({ actorUserId: userId, organizationId: input.organizationId }, input);
  });
}
