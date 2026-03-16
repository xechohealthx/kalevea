import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { getBuyAndBillCase } from "@/server/services/buy-and-bill/buy-and-bill.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { caseId } = await params;
    return getBuyAndBillCase({ actorUserId: userId }, caseId);
  });
}
