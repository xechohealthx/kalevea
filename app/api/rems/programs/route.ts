import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { listPrograms } from "@/server/services/rems/rems.service";

export async function GET() {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();

    return listPrograms({ actorUserId: userId });
  });
}

