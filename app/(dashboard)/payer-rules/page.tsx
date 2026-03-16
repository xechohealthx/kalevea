import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { listPayerRuleSuggestions, listPayerRules } from "@/server/services/payer-rules/payer-rule.service";
import { PayerRulesAdminPanel } from "@/components/payer-rules/payer-rules-admin-panel";

export default async function PayerRulesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await getAccessSnapshot(session.user.id);
  const organizations = await prisma.organization.findMany({
    where: {
      id:
        access.globalRoleKeys.length > 0
          ? undefined
          : { in: access.accessibleOrganizationIds },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const clinics = await prisma.clinic.findMany({
    where: { id: { in: access.accessibleClinicIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const defaultOrganizationId = organizations[0]?.id;
  const [rules, suggestions] = await Promise.all([
    listPayerRules({ actorUserId: session.user.id }, { organizationId: defaultOrganizationId, limit: 150 }),
    listPayerRuleSuggestions(
      { actorUserId: session.user.id },
      { organizationId: defaultOrganizationId, limit: 150 },
    ),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payer Rules</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Structured payer rule intelligence with AI-assisted extraction and human approval workflow.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rule intelligence workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <PayerRulesAdminPanel
            organizations={organizations}
            clinics={clinics}
            rules={rules.map((rule) => ({
              id: rule.id,
              payerName: rule.payerName,
              ruleCategory: rule.ruleCategory,
              title: rule.title,
              isActive: rule.isActive,
              confidenceLevel: rule.confidenceLevel,
              clinic: rule.clinic ? { id: rule.clinic.id, name: rule.clinic.name } : null,
              expectedReimbursementAmount:
                rule.expectedReimbursementAmount !== null ? Number(rule.expectedReimbursementAmount.toString()) : null,
              expectedReimbursementMin:
                rule.expectedReimbursementMin !== null ? Number(rule.expectedReimbursementMin.toString()) : null,
              expectedReimbursementMax:
                rule.expectedReimbursementMax !== null ? Number(rule.expectedReimbursementMax.toString()) : null,
            }))}
            suggestions={suggestions.map((suggestion) => ({
              id: suggestion.id,
              payerName: suggestion.payerName,
              status: suggestion.status,
              model: suggestion.model,
              createdAt: suggestion.createdAt,
              suggestedRuleJSON: suggestion.suggestedRuleJSON,
              sourceDocument: suggestion.sourceDocument
                ? { id: suggestion.sourceDocument.id, title: suggestion.sourceDocument.title }
                : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
