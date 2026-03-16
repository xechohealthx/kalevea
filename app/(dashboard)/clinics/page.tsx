import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { AddClinicDialog } from "@/components/clinics/add-clinic-dialog";
import { WorkspaceHeader } from "@/components/system/layout/workspace-header";
import { StatusBadge, type StatusTone } from "@/components/system/data-display/status-badge";
import { EntityTable, type EntityTableColumn } from "@/components/system/data-display/entity-table";
import { EntityPanel } from "@/components/system/entity/entity-panel";
import { EmptyState } from "@/components/system/feedback/empty-state";
import { FilterBar } from "@/components/system/forms/filter-bar";
import { clinicFilterSchema, listClinics } from "@/server/services/clinics/clinic.service";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ClinicRow = Awaited<ReturnType<typeof listClinics>>[number];

function toClinicStatusTone(status: string): StatusTone {
  if (status === "ACTIVE") return "success";
  if (status === "ONBOARDING") return "warning";
  if (status === "PAUSED") return "danger";
  return "neutral";
}

function formatClinicType(type: string) {
  return type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function ClinicsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const filter = clinicFilterSchema.parse({
    status: typeof searchParams.status === "string" ? searchParams.status : undefined,
    clinicType: typeof searchParams.clinicType === "string" ? searchParams.clinicType : undefined,
    q: typeof searchParams.q === "string" ? searchParams.q : undefined,
  });

  const access = await getAccessSnapshot(session.user.id);
  const clinics = await listClinics({ actorUserId: session.user.id }, filter);
  const activeClinics = clinics.filter((clinic) => clinic.status === "ACTIVE").length;
  const onboardingClinics = clinics.filter((clinic) => clinic.status === "ONBOARDING").length;
  const pausedClinics = clinics.filter((clinic) => clinic.status === "PAUSED").length;

  const clinicColumns: Array<EntityTableColumn<ClinicRow>> = [
    {
      id: "clinic",
      header: "Clinic",
      cell: (clinic) => (
        <div>
          <Link className="font-medium hover:underline" href={`/clinics/${clinic.id}`}>
            {clinic.name}
          </Link>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{clinic.slug}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (clinic) => <StatusBadge label={clinic.status} tone={toClinicStatusTone(clinic.status)} />,
    },
    {
      id: "type",
      header: "Type",
      cell: (clinic) => formatClinicType(clinic.clinicType),
    },
    {
      id: "location",
      header: "Location",
      cell: (clinic) => (clinic.city ? `${clinic.city}, ${clinic.state ?? ""}`.trim() : "—"),
    },
    {
      id: "organization",
      header: "Organization",
      cell: (clinic) => <span className="text-sm text-zinc-600 dark:text-zinc-400">{clinic.organization.name}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Clinics"
        description="Manage clinic workspaces, operational status, and onboarding progression across your organization scope."
        scopeLabel="Clinic workspace index"
        actions={access.defaultOrganizationId ? <AddClinicDialog organizationId={access.defaultOrganizationId} /> : null}
      />

      <FilterBar
        left={
          <>
            <StatusBadge label={`${clinics.length} clinics`} tone="neutral" />
            <StatusBadge label={`${activeClinics} active`} tone="success" />
            <StatusBadge label={`${onboardingClinics} onboarding`} tone="warning" />
            <StatusBadge label={`${pausedClinics} paused`} tone={pausedClinics > 0 ? "danger" : "neutral"} />
          </>
        }
      />

      <EntityPanel title="Clinic directory" subtitle="Filter and navigate clinic operational workspaces by status and type.">
        <form className="grid gap-3 md:grid-cols-4" action="/clinics" method="get">
          <Input name="q" defaultValue={filter.q ?? ""} placeholder="Search clinics..." />
          <select
            name="status"
            defaultValue={filter.status ?? ""}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">All statuses</option>
            <option value="PROSPECT">Prospect</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
          </select>
          <select
            name="clinicType"
            defaultValue={filter.clinicType ?? ""}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">All types</option>
            <option value="PRIMARY_CARE">Primary Care</option>
            <option value="PSYCHIATRY">Psychiatry</option>
            <option value="HOSPITAL_OUTPATIENT">Hospital Outpatient</option>
            <option value="SPECIALTY">Specialty</option>
          </select>
          <Button type="submit">Apply</Button>
        </form>

        <EntityTable
          columns={clinicColumns}
          rows={clinics}
          getRowKey={(clinic) => clinic.id}
          emptyState={
            <EmptyState
              title="No clinics match your filters"
              description="Adjust status, type, or search terms to broaden the workspace directory results."
            />
          }
        />
      </EntityPanel>
    </div>
  );
}

