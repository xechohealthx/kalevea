import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { approvePayerRuleSuggestionSchema } from "@/server/services/payer-rules/payer-rule.schemas";
import { approveSuggestion } from "@/server/services/payer-rules/payer-rule.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { id } = await params;
    const json = await req.json().catch(() => ({}));
    const parsed = approvePayerRuleSuggestionSchema.parse(json);

    return approveSuggestion({ actorUserId: userId }, id, {
      activate: parsed.activate,
      confidenceLevel: parsed.confidenceLevel,
      effectiveDate: parsed.effectiveDate ? new Date(parsed.effectiveDate) : undefined,
      endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
    });
  });
}
