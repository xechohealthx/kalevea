import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { createPACaseSchema, listPACasesSchema } from "@/server/services/prior-auth/prior-auth.schemas";
import { createPACase, listPACases } from "@/server/services/prior-auth/prior-auth.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);

    const parsed = listPACasesSchema.parse({
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    return listPACases(
      { actorUserId: userId },
      { clinicId: parsed.clinicId, status: parsed.status, limit: parsed.limit },
    );
  });
}

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const parsed = createPACaseSchema.parse(json);

    return createPACase(
      { actorUserId: userId, clinicId: parsed.clinicId },
      {
        clinicId: parsed.clinicId,
        payerName: parsed.payerName,
        medicationName: parsed.medicationName,
        patientReferenceId: parsed.patientReferenceId,
        initialNote: parsed.initialNote,
        documentIds: parsed.documentIds,
      },
    );
  });
}
