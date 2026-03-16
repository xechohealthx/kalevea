import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { listPayerRuleSuggestionsSchema } from "@/server/services/payer-rules/payer-rule.schemas";
import { listPayerRuleSuggestions } from "@/server/services/payer-rules/payer-rule.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = listPayerRuleSuggestionsSchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    return listPayerRuleSuggestions({ actorUserId: userId }, parsed);
  });
}
