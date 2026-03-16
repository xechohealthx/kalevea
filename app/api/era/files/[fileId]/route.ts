import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { getEraFile } from "@/server/services/era/era.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { fileId } = await params;
    return getEraFile({ actorUserId: userId }, fileId);
  });
}
