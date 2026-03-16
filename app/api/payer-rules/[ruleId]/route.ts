import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { updatePayerRuleSchema } from "@/server/services/payer-rules/payer-rule.schemas";
import { updatePayerRule } from "@/server/services/payer-rules/payer-rule.service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { ruleId } = await params;
    const json = await req.json();
    const parsed = updatePayerRuleSchema.parse(json);

    return updatePayerRule({ actorUserId: userId }, ruleId, {
      title: parsed.title,
      description: parsed.description,
      ruleCategory: parsed.ruleCategory,
      clinicId: parsed.clinicId,
      medicationCatalogItemId: parsed.medicationCatalogItemId,
      stateCode: parsed.stateCode,
      serviceContext: parsed.serviceContext,
      expectedReimbursementAmount: parsed.expectedReimbursementAmount,
      expectedReimbursementMin: parsed.expectedReimbursementMin,
      expectedReimbursementMax: parsed.expectedReimbursementMax,
      confidenceLevel: parsed.confidenceLevel,
      sourceType: parsed.sourceType,
      isActive: parsed.isActive,
      effectiveDate:
        parsed.effectiveDate === undefined
          ? undefined
          : parsed.effectiveDate === null
            ? null
            : new Date(parsed.effectiveDate),
      endDate:
        parsed.endDate === undefined ? undefined : parsed.endDate === null ? null : new Date(parsed.endDate),
    });
  });
}
