import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  createPayerRuleSchema,
  listPayerRulesSchema,
} from "@/server/services/payer-rules/payer-rule.schemas";
import { createPayerRule, listPayerRules } from "@/server/services/payer-rules/payer-rule.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = listPayerRulesSchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      clinicId: url.searchParams.get("clinicId") ?? undefined,
      payerName: url.searchParams.get("payerName") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      isActive: url.searchParams.get("isActive") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    return listPayerRules({ actorUserId: userId }, parsed);
  });
}

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const parsed = createPayerRuleSchema.parse(json);

    return createPayerRule(
      { actorUserId: userId, organizationId: parsed.organizationId, clinicId: parsed.clinicId },
      {
        organizationId: parsed.organizationId,
        clinicId: parsed.clinicId,
        payerName: parsed.payerName,
        ruleCategory: parsed.ruleCategory,
        title: parsed.title,
        description: parsed.description,
        medicationCatalogItemId: parsed.medicationCatalogItemId,
        stateCode: parsed.stateCode,
        serviceContext: parsed.serviceContext,
        expectedReimbursementAmount: parsed.expectedReimbursementAmount,
        expectedReimbursementMin: parsed.expectedReimbursementMin,
        expectedReimbursementMax: parsed.expectedReimbursementMax,
        confidenceLevel: parsed.confidenceLevel,
        sourceType: parsed.sourceType,
        isActive: parsed.isActive,
        effectiveDate: parsed.effectiveDate ? new Date(parsed.effectiveDate) : undefined,
        endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
        evidenceDocumentId: parsed.evidenceDocumentId,
        evidenceSourceLabel: parsed.evidenceSourceLabel,
        evidenceNote: parsed.evidenceNote,
      },
    );
  });
}
