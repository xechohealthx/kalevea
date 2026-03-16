import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { StatusBadge, type StatusTone } from "@/components/system/data-display/status-badge";
import { MetricCard } from "@/components/system/data-display/metric-card";
import { WorkspaceHeader } from "@/components/system/layout/workspace-header";
import { EntityPanel } from "@/components/system/entity/entity-panel";
import { EntityTable, type EntityTableColumn } from "@/components/system/data-display/entity-table";
import { Timeline } from "@/components/system/workflow/timeline";
import { EmptyState } from "@/components/system/feedback/empty-state";
import { FilterBar } from "@/components/system/forms/filter-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getClinicById } from "@/server/services/clinics/clinic.service";
import { Button } from "@/components/ui/button";

function toClinicStatusTone(status: string): StatusTone {
  if (status === "ACTIVE") return "success";
  if (status === "ONBOARDING") return "warning";
  if (status === "PAUSED") return "danger";
  return "neutral";
}

type ModuleRow = {
  id: string;
  module: string;
  signal: string;
  linkHref: string;
  linkLabel: string;
};

export default async function ClinicWorkspacePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = params;
  const clinic = await getClinicById({ actorUserId: session.user.id }, id);

  const [providers, staff, openTickets, assignments, documents, onboardingTasks] =
    await Promise.all([
      prisma.provider.count({ where: { clinicId: clinic.id } }),
      prisma.staffProfile.count({ where: { clinicId: clinic.id } }),
      prisma.supportTicket.count({
        where: {
          clinicId: clinic.id,
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        },
      }),
      prisma.trainingAssignment.count({ where: { clinicId: clinic.id } }),
      prisma.document.count({ where: { clinicId: clinic.id } }),
      prisma.onboardingTask.count({ where: { project: { clinicId: clinic.id } } }),
    ]);

  const moduleRows: ModuleRow[] = [
    {
      id: "onboarding",
      module: "Onboarding",
      signal: clinic.onboarding ? clinic.onboarding.status : "NOT_STARTED",
      linkHref: "/onboarding",
      linkLabel: "Manage onboarding",
    },
    {
      id: "providers",
      module: "Providers/Staff",
      signal: `${providers} providers · ${staff} staff profiles`,
      linkHref: "/providers",
      linkLabel: "Manage providers",
    },
    {
      id: "support",
      module: "Support",
      signal: `${openTickets} open ticket${openTickets === 1 ? "" : "s"}`,
      linkHref: "/support",
      linkLabel: "Open support workspace",
    },
    {
      id: "training",
      module: "Training",
      signal: `${assignments} assignment${assignments === 1 ? "" : "s"}`,
      linkHref: "/training",
      linkLabel: "Open training workspace",
    },
    {
      id: "documents",
      module: "Documents",
      signal: `${documents} document${documents === 1 ? "" : "s"}`,
      linkHref: "/documents",
      linkLabel: "Open document workspace",
    },
  ];

  const moduleColumns: Array<EntityTableColumn<ModuleRow>> = [
    { id: "module", header: "Module", cell: (row) => <span className="font-medium">{row.module}</span> },
    { id: "signal", header: "Operational signal", cell: (row) => row.signal },
    {
      id: "action",
      header: "Action",
      cell: (row) => (
        <Link className="text-sm font-medium text-zinc-900 underline dark:text-zinc-100" href={row.linkHref}>
          {row.linkLabel}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title={clinic.name}
        description="Clinic operational workspace overview across onboarding, staffing, support, training, and documents."
        scopeLabel="Clinic workspace"
        meta={`Clinic type: ${clinic.clinicType}`}
        actions={
          <>
            <Link
              href={`/kal?intent=onboarding&clinicId=${encodeURIComponent(clinic.id)}&organizationId=${encodeURIComponent(clinic.organizationId)}&screen=clinic-workspace&query=${encodeURIComponent(`Explain onboarding and operational readiness for clinic ${clinic.name}.`)}`}
            >
              <Button variant="outline" size="sm">
                Explain clinic with Kal
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button variant="outline" size="sm">
                View onboarding
              </Button>
            </Link>
            <Link href="/support">
              <Button variant="outline" size="sm">
                View support
              </Button>
            </Link>
          </>
        }
      />

      <FilterBar
        left={
          <>
            <StatusBadge label={clinic.status} tone={toClinicStatusTone(clinic.status)} />
            <StatusBadge label={clinic.clinicType} tone="neutral" />
          </>
        }
        right={
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Organization: {clinic.organization.name}
          </span>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="providers">Providers/Staff</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard label="Providers" value={providers} />
              <MetricCard label="Staff profiles" value={staff} />
              <MetricCard label="Open support tickets" value={openTickets} />
              <MetricCard label="Training assignments" value={assignments} />
              <MetricCard label="Documents" value={documents} />
              <MetricCard label="Onboarding tasks" value={onboardingTasks} />
            </div>

            <EntityPanel
              title="Operational module routing"
              subtitle="Use these module workspaces to continue clinic operations."
            >
              <EntityTable columns={moduleColumns} rows={moduleRows} getRowKey={(row) => row.id} />
            </EntityPanel>

            <EntityPanel
              title="Operational timeline snapshot"
              subtitle="Current-state signals for this clinic workspace."
            >
              <Timeline
                items={[
                  {
                    id: "onboarding",
                    title: "Onboarding project",
                    description: clinic.onboarding
                      ? `Current status: ${clinic.onboarding.status}`
                      : "No onboarding project is currently active.",
                    meta: "Onboarding",
                  },
                  {
                    id: "support",
                    title: "Support workload",
                    description: `${openTickets} open support ticket${openTickets === 1 ? "" : "s"} in active statuses.`,
                    meta: "Support",
                  },
                  {
                    id: "training",
                    title: "Training readiness",
                    description: `${assignments} active assignment${assignments === 1 ? "" : "s"} tracked for this clinic.`,
                    meta: "Training",
                  },
                ]}
              />
            </EntityPanel>
          </div>
        </TabsContent>

        <TabsContent value="onboarding">
          <EntityPanel title="Onboarding status" subtitle="Current onboarding project signal for this clinic.">
            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <div>
                Project:{" "}
                <span className="font-medium text-zinc-950 dark:text-zinc-50">
                  {clinic.onboarding ? clinic.onboarding.status : "Not started"}
                </span>
              </div>
              <div className="text-xs">
                Go to <Link className="underline" href="/onboarding">Onboarding</Link> to manage tasks.
              </div>
            </div>
            {!clinic.onboarding ? (
              <EmptyState
                title="No onboarding project in progress"
                description="Start onboarding from the onboarding workspace when this clinic is ready."
              />
            ) : null}
          </EntityPanel>
        </TabsContent>

        <TabsContent value="providers">
          <EntityPanel title="Providers & staff" subtitle="Staffing and provider operations for this clinic workspace.">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Manage providers and staff in the <Link className="underline" href="/providers">Providers</Link> module.
            </div>
          </EntityPanel>
        </TabsContent>

        <TabsContent value="support">
          <EntityPanel title="Support" subtitle="Open support queue and clinic issue resolution workflows.">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              View and create support tickets in <Link className="underline" href="/support">Support</Link>.
            </div>
          </EntityPanel>
        </TabsContent>

        <TabsContent value="training">
          <EntityPanel title="Training" subtitle="Training assignment execution and readiness progression.">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Courses and assignments are managed in <Link className="underline" href="/training">Training</Link>.
            </div>
          </EntityPanel>
        </TabsContent>

        <TabsContent value="documents">
          <EntityPanel title="Documents" subtitle="Document storage, metadata, and operational file handling.">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Document metadata and uploads live in <Link className="underline" href="/documents">Documents</Link>.
            </div>
          </EntityPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

