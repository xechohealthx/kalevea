import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { recordMedicationAdministrationSchema } from "@/server/services/buy-and-bill/buy-and-bill.schemas";
import { recordMedicationAdministration } from "@/server/services/buy-and-bill/buy-and-bill.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { caseId } = await params;
    const json = await req.json();
    const parsed = recordMedicationAdministrationSchema.parse(json);

    return recordMedicationAdministration(
      { actorUserId: userId },
      caseId,
      {
        medicationLotId: parsed.medicationLotId,
        administeredAt: new Date(parsed.administeredAt),
        unitsAdministered: parsed.unitsAdministered,
        notes: parsed.notes,
        documentIds: parsed.documentIds,
      },
    );
  });
}
