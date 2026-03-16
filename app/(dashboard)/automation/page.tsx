import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { listAutomationEvents, listAutomationRules } from "@/server/services/automation/automation-engine.service";
import { AutomationAdminPanel } from "@/components/automation/automation-admin-panel";

export default async function AutomationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await getAccessSnapshot(session.user.id);
  const organizations = await prisma.organization.findMany({
    where: access.globalRoleKeys.length > 0 ? undefined : { id: { in: access.accessibleOrganizationIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const defaultOrganizationId = organizations[0]?.id ?? access.defaultOrganizationId;
  if (!defaultOrganizationId) redirect("/dashboard");

  const [rules, events] = await Promise.all([
    listAutomationRules(
      { actorUserId: session.user.id, organizationId: defaultOrganizationId },
      { organizationId: defaultOrganizationId, limit: 100 },
    ),
    listAutomationEvents(
      { actorUserId: session.user.id, organizationId: defaultOrganizationId },
      { organizationId: defaultOrganizationId, limit: 100 },
    ),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operational Automation</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Define rules, run evaluations, and track automation actions across organization operations.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Automation engine workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <AutomationAdminPanel
            organizations={organizations}
            defaultOrganizationId={defaultOrganizationId}
            rules={rules.map((r) => ({
              id: r.id,
              ruleType: r.ruleType,
              isActive: r.isActive,
              conditionConfig: r.conditionConfig,
              actionConfig: r.actionConfig,
              createdAt: r.createdAt,
            }))}
            events={events.map((e) => ({
              id: e.id,
              ruleId: e.ruleId,
              targetEntityType: e.targetEntityType,
              targetEntityId: e.targetEntityId,
              actionExecuted: e.actionExecuted,
              status: e.status,
              triggeredAt: e.triggeredAt,
              errorMessage: e.errorMessage,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
