import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { getPACase } from "@/server/services/prior-auth/prior-auth.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { caseId } = await params;
    return getPACase({ actorUserId: userId }, caseId);
  });
}
