import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  createMedicationLotSchema,
  listMedicationLotsSchema,
} from "@/server/services/buy-and-bill/buy-and-bill.schemas";
import {
  createMedicationLot,
  listMedicationLots,
} from "@/server/services/buy-and-bill/buy-and-bill.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = listMedicationLotsSchema.parse({
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      medicationCatalogItemId: url.searchParams.get("medicationCatalogItemId") ?? undefined,
      includeDepleted: url.searchParams.get("includeDepleted") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    return listMedicationLots(
      { actorUserId: userId },
      {
        clinicId: parsed.clinicId,
        medicationCatalogItemId: parsed.medicationCatalogItemId,
        includeDepleted: parsed.includeDepleted,
        limit: parsed.limit,
      },
    );
  });
}

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const parsed = createMedicationLotSchema.parse(json);

    return createMedicationLot(
      { actorUserId: userId, clinicId: parsed.clinicId },
      {
        clinicId: parsed.clinicId,
        medicationCatalogItemId: parsed.medicationCatalogItemId,
        lotNumber: parsed.lotNumber,
        expirationDate: new Date(parsed.expirationDate),
        quantityReceived: parsed.quantityReceived,
        acquisitionDate: new Date(parsed.acquisitionDate),
        supplierName: parsed.supplierName,
        invoiceReference: parsed.invoiceReference,
        documentIds: parsed.documentIds,
      },
    );
  });
}
