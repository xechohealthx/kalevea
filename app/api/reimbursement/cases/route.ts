import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  createReimbursementCaseSchema,
  listReimbursementCasesSchema,
} from "@/server/services/reimbursement/reimbursement.schemas";
import {
  createReimbursementCase,
  listReimbursementCases,
} from "@/server/services/reimbursement/reimbursement.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);

    const parsed = listReimbursementCasesSchema.parse({
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    return listReimbursementCases(
      { actorUserId: userId },
      { clinicId: parsed.clinicId, status: parsed.status, limit: parsed.limit },
    );
  });
}

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const parsed = createReimbursementCaseSchema.parse(json);

    return createReimbursementCase(
      { actorUserId: userId, clinicId: parsed.clinicId },
      {
        clinicId: parsed.clinicId,
        buyAndBillCaseId: parsed.buyAndBillCaseId,
        priorAuthorizationCaseId: parsed.priorAuthorizationCaseId,
        patientReferenceId: parsed.patientReferenceId,
        payerName: parsed.payerName,
        expectedAmount: parsed.expectedAmount,
        expectedAllowedAmount: parsed.expectedAllowedAmount,
        initialNote: parsed.initialNote,
        documentIds: parsed.documentIds,
      },
    );
  });
}
