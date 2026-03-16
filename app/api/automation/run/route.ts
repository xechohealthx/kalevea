import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { runAutomationSchema } from "@/server/services/automation/automation.schemas";
import { evaluateAutomationRules } from "@/server/services/automation/automation-engine.service";

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const parsed = runAutomationSchema.parse(json);
    return evaluateAutomationRules(
      { actorUserId: userId, organizationId: parsed.organizationId },
      { organizationId: parsed.organizationId, ruleId: parsed.ruleId },
    );
  });
}
