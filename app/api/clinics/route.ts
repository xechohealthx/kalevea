import { NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";
import { AppError } from "@/lib/utils";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  clinicFilterSchema,
  createClinicSchema,
  createClinic,
  listClinics,
} from "@/server/services/clinics/clinic.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new AppError("Authentication required", "UNAUTHENTICATED", 401);

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
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new AppError("Authentication required", "UNAUTHENTICATED", 401);

    const json = await req.json();
    const input = createClinicSchema.parse(json);
    return createClinic({ actorUserId: userId, organizationId: input.organizationId }, input);
  });
}

