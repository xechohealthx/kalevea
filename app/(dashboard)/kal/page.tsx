import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { buildKalContext } from "@/server/services/ai/kal-context.service";
import { KalAssistantPanel } from "@/components/kal/kal-assistant-panel";
import type { KalIntent } from "@/server/services/ai/kal.schemas";

export default async function KalPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await getAccessSnapshot(session.user.id);
  const requestedOrganizationId = typeof searchParams.organizationId === "string" ? searchParams.organizationId : undefined;
  const requestedClinicId = typeof searchParams.clinicId === "string" ? searchParams.clinicId : undefined;
  const requestedIntent =
    typeof searchParams.intent === "string" ? (searchParams.intent as KalIntent) : "general";
  const requestedQuery = typeof searchParams.query === "string" ? searchParams.query : undefined;
  const screen = typeof searchParams.screen === "string" ? searchParams.screen : undefined;

  const organizations = await prisma.organization.findMany({
    where: access.globalRoleKeys.length > 0 ? undefined : { id: { in: access.accessibleOrganizationIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const defaultOrganizationId = requestedOrganizationId ?? organizations[0]?.id ?? access.defaultOrganizationId;
  if (!defaultOrganizationId) redirect("/dashboard");

  const clinics = await prisma.clinic.findMany({
    where: {
      organizationId: defaultOrganizationId,
      id: access.globalRoleKeys.length > 0 ? undefined : { in: access.accessibleClinicIds },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const initialContext = await buildKalContext(
    { actorUserId: session.user.id, organizationId: defaultOrganizationId, clinicId: requestedClinicId },
    { organizationId: defaultOrganizationId, clinicId: requestedClinicId, intent: requestedIntent },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kal AI Assistant</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Kal is an operational copilot for PA, reimbursement, onboarding, benchmarking, and revenue optimization workflows.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Operations copilot workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <KalAssistantPanel
            organizations={organizations}
            clinics={clinics}
            defaultOrganizationId={defaultOrganizationId}
            defaultClinicId={requestedClinicId ?? clinics[0]?.id}
            initialContextToolNames={initialContext.tools.map((tool) => tool.toolName)}
            initialIntent={requestedIntent}
            initialQuery={requestedQuery}
            screenContextLabel={screen}
          />
        </CardContent>
      </Card>
    </div>
  );
}
