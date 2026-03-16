import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { getReimbursementCase } from "@/server/services/reimbursement/reimbursement.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { caseId } = await params;
    return getReimbursementCase({ actorUserId: userId }, caseId);
  });
}
