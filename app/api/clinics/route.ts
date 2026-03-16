import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  clinicFilterSchema,
  createClinicSchema,
  createClinic,
  listClinics,
} from "@/server/services/clinics/clinic.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();

    const url = new URL(req.url);
    const filter = clinicFilterSchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      clinicType: url.searchParams.get("clinicType") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    });

    return listClinics({ actorUserId: userId }, filter);
  });
}

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();

    const json = await req.json();
    const input = createClinicSchema.parse(json);
    return createClinic({ actorUserId: userId, organizationId: input.organizationId }, input);
  });
}

