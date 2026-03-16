import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { createPaymentRecordSchema } from "@/server/services/reimbursement/reimbursement.schemas";
import { createPaymentRecord } from "@/server/services/reimbursement/reimbursement.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { caseId } = await params;
    const json = await req.json();
    const parsed = createPaymentRecordSchema.parse(json);

    return createPaymentRecord(
      { actorUserId: userId },
      caseId,
      {
        claimRecordId: parsed.claimRecordId,
        paidAmount: parsed.paidAmount,
        paidDate: new Date(parsed.paidDate),
        sourceType: parsed.sourceType,
        referenceNumber: parsed.referenceNumber,
        notes: parsed.notes,
        documentIds: parsed.documentIds,
      },
    );
  });
}
