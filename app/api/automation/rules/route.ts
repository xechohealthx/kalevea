import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  createAutomationRuleSchema,
  listAutomationRulesSchema,
} from "@/server/services/automation/automation.schemas";
import { createAutomationRule, listAutomationRules } from "@/server/services/automation/automation-engine.service";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = listAutomationRulesSchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      isActive: url.searchParams.get("isActive") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    return listAutomationRules({ actorUserId: userId, organizationId: parsed.organizationId }, parsed);
  });
}

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const parsed = createAutomationRuleSchema.parse(json);
    return createAutomationRule(
      { actorUserId: userId, organizationId: parsed.organizationId },
      {
        organizationId: parsed.organizationId,
        ruleType: parsed.ruleType,
        conditionConfig: parsed.conditionConfig,
        actionConfig: parsed.actionConfig,
        isActive: parsed.isActive,
      },
    );
  });
}
