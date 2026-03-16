import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  createStaffProfile,
  createStaffSchema,
  listStaffProfiles,
  providerFilterSchema,
} from "@/server/services/providers/provider.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();

    const url = new URL(req.url);
    const filter = providerFilterSchema.parse({
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    });

    return listStaffProfiles({ actorUserId: userId }, filter);
  });
}

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();

    const json = await req.json();
    const input = createStaffSchema.parse(json);
    return createStaffProfile({ actorUserId: userId, clinicId: input.clinicId }, input);
  });
}

