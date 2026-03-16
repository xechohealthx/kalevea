import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { updatePAStatusSchema } from "@/server/services/prior-auth/prior-auth.schemas";
import { updatePAStatus } from "@/server/services/prior-auth/prior-auth.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { caseId } = await params;
    const json = await req.json();
    const parsed = updatePAStatusSchema.parse(json);

    return updatePAStatus(
      { actorUserId: userId },
      caseId,
      {
        status: parsed.status,
        note: parsed.note,
        documentIds: parsed.documentIds,
      },
    );
  });
}
