import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { updateReimbursementStatusSchema } from "@/server/services/reimbursement/reimbursement.schemas";
import { updateReimbursementStatus } from "@/server/services/reimbursement/reimbursement.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { caseId } = await params;
    const json = await req.json();
    const parsed = updateReimbursementStatusSchema.parse(json);

    return updateReimbursementStatus(
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
