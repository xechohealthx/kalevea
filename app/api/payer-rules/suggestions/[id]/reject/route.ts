import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { rejectPayerRuleSuggestionSchema } from "@/server/services/payer-rules/payer-rule.schemas";
import { rejectSuggestion } from "@/server/services/payer-rules/payer-rule.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { id } = await params;
    const json = await req.json().catch(() => ({}));
    const parsed = rejectPayerRuleSuggestionSchema.parse(json);

    return rejectSuggestion({ actorUserId: userId }, id, { note: parsed.note });
  });
}
