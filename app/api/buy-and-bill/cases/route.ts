import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  createBuyAndBillCaseSchema,
  listBuyAndBillCasesSchema,
} from "@/server/services/buy-and-bill/buy-and-bill.schemas";
import {
  createBuyAndBillCase,
  listBuyAndBillCases,
} from "@/server/services/buy-and-bill/buy-and-bill.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = listBuyAndBillCasesSchema.parse({
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    return listBuyAndBillCases(
      { actorUserId: userId },
      { clinicId: parsed.clinicId, status: parsed.status, limit: parsed.limit },
    );
  });
}

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const parsed = createBuyAndBillCaseSchema.parse(json);

    return createBuyAndBillCase(
      { actorUserId: userId, clinicId: parsed.clinicId },
      {
        clinicId: parsed.clinicId,
        patientReferenceId: parsed.patientReferenceId,
        medicationCatalogItemId: parsed.medicationCatalogItemId,
        priorAuthorizationCaseId: parsed.priorAuthorizationCaseId,
        expectedReimbursementAmount: parsed.expectedReimbursementAmount,
        expectedPayerName: parsed.expectedPayerName,
        initialNote: parsed.initialNote,
        documentIds: parsed.documentIds,
      },
    );
  });
}
