import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { createClaimRecordSchema } from "@/server/services/reimbursement/reimbursement.schemas";
import { createClaimRecord } from "@/server/services/reimbursement/reimbursement.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { caseId } = await params;
    const json = await req.json();
    const parsed = createClaimRecordSchema.parse(json);

    return createClaimRecord(
      { actorUserId: userId },
      caseId,
      {
        externalClaimId: parsed.externalClaimId,
        claimNumber: parsed.claimNumber,
        payerName: parsed.payerName,
        submittedAt: parsed.submittedAt ? new Date(parsed.submittedAt) : undefined,
        status: parsed.status,
        billedAmount: parsed.billedAmount,
        notes: parsed.notes,
        documentIds: parsed.documentIds,
      },
    );
  });
}
