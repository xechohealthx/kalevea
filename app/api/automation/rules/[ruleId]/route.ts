import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { updateAutomationRuleSchema } from "@/server/services/automation/automation.schemas";
import { updateAutomationRule } from "@/server/services/automation/automation-engine.service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const { ruleId } = await params;
    const json = await req.json();
    const parsed = updateAutomationRuleSchema.parse(json);
    return updateAutomationRule({ actorUserId: userId }, ruleId, {
      conditionConfig: parsed.conditionConfig,
      actionConfig: parsed.actionConfig,
      isActive: parsed.isActive,
    });
  });
}
