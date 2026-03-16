import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { updateBuyAndBillStatusSchema } from "@/server/services/buy-and-bill/buy-and-bill.schemas";
import { updateBuyAndBillStatus } from "@/server/services/buy-and-bill/buy-and-bill.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { caseId } = await params;
    const json = await req.json();
    const parsed = updateBuyAndBillStatusSchema.parse(json);

    return updateBuyAndBillStatus(
      { actorUserId: userId },
      caseId,
      {
        status: parsed.status,
        note: parsed.note,
        documentIds: parsed.documentIds,
      },
    );
  });
}
