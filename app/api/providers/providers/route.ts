import { NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";
import { AppError } from "@/lib/utils";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  createProvider,
  createProviderSchema,
  listProviders,
  providerFilterSchema,
} from "@/server/services/providers/provider.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new AppError("Authentication required", "UNAUTHENTICATED", 401);

    const url = new URL(req.url);
    const filter = providerFilterSchema.parse({
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    });

    return listProviders({ actorUserId: userId }, filter);
  });
}

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new AppError("Authentication required", "UNAUTHENTICATED", 401);

    const json = await req.json();
    const input = createProviderSchema.parse(json);
    return createProvider({ actorUserId: userId, clinicId: input.clinicId }, input);
  });
}

