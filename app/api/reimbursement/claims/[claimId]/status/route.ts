import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { updateClaimRecordStatusSchema } from "@/server/services/reimbursement/reimbursement.schemas";
import { updateClaimRecordStatus } from "@/server/services/reimbursement/reimbursement.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ claimId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { claimId } = await params;
    const json = await req.json();
    const parsed = updateClaimRecordStatusSchema.parse(json);

    return updateClaimRecordStatus(
      { actorUserId: userId },
      claimId,
      {
        status: parsed.status,
        note: parsed.note,
      },
    );
  });
}
