import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { extractPayerRuleCandidatesSchema } from "@/server/services/payer-rules/payer-rule.schemas";
import { extractPayerRuleCandidatesFromDocument } from "@/server/services/payer-rules/payer-rule-ai.service";

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const parsed = extractPayerRuleCandidatesSchema.parse(json);

    return extractPayerRuleCandidatesFromDocument(
      { actorUserId: userId, organizationId: parsed.organizationId },
      {
        organizationId: parsed.organizationId,
        documentId: parsed.documentId,
        payerName: parsed.payerName,
        model: parsed.model,
      },
    );
  });
}
