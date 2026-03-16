import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { Badge } from "@/components/ui/badge";
import { WorkspaceHeader } from "@/components/system/layout/workspace-header";
import { MetricCard } from "@/components/system/data-display/metric-card";
import {
  EntityTable,
  type EntityTableColumn,
} from "@/components/system/data-display/entity-table";
import { StatusBadge, type StatusTone } from "@/components/system/data-display/status-badge";
import { EntityPanel } from "@/components/system/entity/entity-panel";
import { Timeline } from "@/components/system/workflow/timeline";
import { EmptyState } from "@/components/system/feedback/empty-state";
import { FilterBar } from "@/components/system/forms/filter-bar";
import { getProviderRemsOverview } from "@/server/services/rems/rems.service";
import { ProviderEnrollmentEditor } from "@/components/rems/provider-enrollment-editor";
import { RemsAttestDialog } from "@/components/rems/attest-dialog";
import { RemsProviderFilters } from "@/components/rems/rems-provider-filters";

function toRemsTone(status: string | null): StatusTone {
  if (status === "ENROLLED") return "success";
  if (status === "PENDING") return "warning";
  if (status === "EXPIRED") return "danger";
  if (status === "SUSPENDED") return "info";
  return "neutral";
}

function getSingleSearchParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function ProviderRemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { providerId } = await params;
  const data = await getProviderRemsOverview({ actorUserId: session.user.id }, providerId);

  const requirementOptions = data.requirements.map((r) => ({
    id: r.id,
    appliesToType: r.appliesToType,
    requirementType: r.requirementType,
    title: r.title,
  }));
  const readinessPercent =
    data.readiness.attestableRequirements > 0
      ? Math.round((data.readiness.attestedRequirements / data.readiness.attestableRequirements) * 100)
      : 0;
  const requirementQuery = getSingleSearchParam(searchParams?.rq).trim();
  const requirementType = getSingleSearchParam(searchParams?.rt).toUpperCase() || "all";
  const requiredFlag = getSingleSearchParam(searchParams?.rr).toLowerCase() || "all";
  const activeFlag = getSingleSearchParam(searchParams?.ra).toLowerCase() || "all";
  const activityQuery = getSingleSearchParam(searchParams?.aq).trim();
  const activityType = getSingleSearchParam(searchParams?.at).toUpperCase() || "all";
  const requirementQueryLower = requirementQuery.toLowerCase();
  const activityQueryLower = activityQuery.toLowerCase();

  const filteredRequirements = data.requirements.filter((requirement) => {
    const matchesText = !requirementQuery
      ? true
      : `${requirement.title} ${requirement.requirementType}`.toLowerCase().includes(requirementQueryLower);
    const matchesType = requirementType === "all" ? true : requirement.requirementType === requirementType;
    const matchesRequired =
      requiredFlag === "all" ||
      (requiredFlag === "required" && requirement.isRequired) ||
      (requiredFlag === "optional" && !requirement.isRequired);
    const matchesActive =
      activeFlag === "all" ||
      (activeFlag === "active" && requirement.isActive) ||
      (activeFlag === "inactive" && !requirement.isActive);

    return matchesText && matchesType && matchesRequired && matchesActive;
  });

  const filteredActivity = data.activity.filter((event) => {
    const matchesType = activityType === "all" ? true : event.type.toUpperCase() === activityType;
    const searchable = `${event.title} ${event.description ?? ""} ${event.type}`.toLowerCase();
    const matchesQuery = !activityQuery ? true : searchable.includes(activityQueryLower);
    return matchesType && matchesQuery;
  });

  const requirementTypes = Array.from(new Set(data.requirements.map((requirement) => requirement.requirementType))).sort();
  const activityTypes = Array.from(new Set(data.activity.map((event) => event.type))).sort();

  const requirementColumns: Array<EntityTableColumn<(typeof data.requirements)[number]>> = [
    {
      id: "type",
      header: "Type",
      cell: (row) => <span className="text-sm text-zinc-600 dark:text-zinc-400">{row.requirementType}</span>,
    },
    {
      id: "title",
      header: "Title",
      cell: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      id: "required",
      header: "Required",
      cell: (row) => (
        <StatusBadge label={row.isRequired ? "Required" : "Optional"} tone={row.isRequired ? "info" : "neutral"} />
      ),
    },
    {
      id: "active",
      header: "Active",
      cell: (row) => <StatusBadge label={row.isActive ? "Active" : "Inactive"} tone={row.isActive ? "success" : "neutral"} />,
    },
  ];

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title={`${data.provider.firstName} ${data.provider.lastName} — REMS`}
        description="Provider-level enrollment, requirement coverage, attestations, and compliance activity."
        scopeLabel="Provider workspace"
        meta={
          <span>
            Clinic:{" "}
            <Link className="underline" href={`/rems/clinics/${data.provider.clinic.id}`}>
              {data.provider.clinic.name}
            </Link>
          </span>
        }
        actions={
          <>
            <RemsAttestDialog
              clinicId={data.provider.clinicId}
              remsProgramId={data.program.id}
              requirements={requirementOptions}
              providers={[{ id: data.provider.id, name: `${data.provider.firstName} ${data.provider.lastName}` }]}
              defaultProviderId={data.provider.id}
            />
            <Link
              href="/rems"
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              Back to REMS
            </Link>
          </>
        }
      />

      <FilterBar
        left={
          <>
            <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
              Program
            </Badge>
            <StatusBadge label={data.program.name} tone="info" />
          </>
        }
        right={
          <>
            <StatusBadge
              label={data.enrollment?.status ?? "NOT_ENROLLED"}
              tone={toRemsTone(data.enrollment?.status ?? null)}
            />
            <StatusBadge label={`Readiness ${readinessPercent}%`} tone="neutral" />
          </>
        }
      />

      <RemsProviderFilters
        requirementQuery={requirementQuery}
        requirementType={requirementType}
        requiredFlag={requiredFlag}
        activeFlag={activeFlag}
        activityQuery={activityQuery}
        activityType={activityType}
        requirementTypes={requirementTypes}
        activityTypes={activityTypes}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Total requirements" value={data.readiness.totalRequirements} className="lg:col-span-1" />
        <MetricCard label="Attestable requirements" value={data.readiness.attestableRequirements} className="lg:col-span-1" />
        <MetricCard label="Attested (MVP)" value={data.readiness.attestedRequirements} className="lg:col-span-1" />
        <MetricCard
          label="Upcoming expirations (30d)"
          value={data.readiness.upcomingExpirations30d}
          trendLabel={data.readiness.upcomingExpirations30d > 0 ? "Renewal window open" : "No near-term expiry"}
          trendTone={data.readiness.upcomingExpirations30d > 0 ? "warning" : "success"}
          className="lg:col-span-1"
        />
        <MetricCard
          label="Expired enrollment"
          value={data.readiness.expiredEnrollments}
          trendLabel={data.readiness.expiredEnrollments > 0 ? "Out of compliance" : "In good standing"}
          trendTone={data.readiness.expiredEnrollments > 0 ? "danger" : "success"}
          className="lg:col-span-1"
        />
      </div>

      <EntityPanel
        title="Enrollment control"
        subtitle="Provider enrollment status and expiration management within the REMS program."
      >
        <FilterBar
          left={
            <StatusBadge
              label={data.enrollment?.status ?? "NOT_ENROLLED"}
              tone={toRemsTone(data.enrollment?.status ?? null)}
            />
          }
          right={
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Expires: {data.enrollment?.expiresAt ? new Date(data.enrollment.expiresAt).toLocaleDateString() : "—"}
            </span>
          }
        />
        <ProviderEnrollmentEditor
          providerId={data.provider.id}
          remsProgramId={data.program.id}
          status={data.enrollment?.status ?? null}
          expiresAt={data.enrollment?.expiresAt ?? null}
        />
      </EntityPanel>

      <EntityPanel
        title="Requirements"
        subtitle="Provider-scoped requirements currently active in this REMS program."
      >
        <EntityTable
          columns={requirementColumns}
          rows={filteredRequirements}
          getRowKey={(row) => row.id}
          emptyState={
            <EmptyState
              title="No requirements match current filters"
              description="Adjust requirement filters to view additional requirement rows."
            />
          }
        />
      </EntityPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <EntityPanel title="Attestations" subtitle="Recent attestations captured for provider requirements.">
          <Timeline
            items={data.attestations.map((attestation) => ({
              id: attestation.id,
              title: attestation.title,
              description: (
                <span>
                  Attested by {attestation.attestedBy.firstName} {attestation.attestedBy.lastName}
                  {attestation.requirement ? ` · Requirement: ${attestation.requirement.title}` : ""}
                  {attestation.notes ? ` · ${attestation.notes}` : ""}
                </span>
              ),
              meta: new Date(attestation.attestedAt).toLocaleString(),
            }))}
            emptyState={
              <EmptyState
                title="No attestations yet"
                description="Attestation records will appear as provider confirmations are completed."
              />
            }
          />
        </EntityPanel>

        <EntityPanel title="Activity" subtitle="Enrollment and compliance events recorded for this provider.">
          <Timeline
            items={filteredActivity.map((event) => ({
              id: event.id,
              title: event.title,
              description: (
                <span>
                  <StatusBadge label={event.type} tone="neutral" />
                  {event.description ? ` · ${event.description}` : ""}
                </span>
              ),
              meta: new Date(event.createdAt).toLocaleString(),
            }))}
            emptyState={
              <EmptyState
                title="No activity matches current filters"
                description="Try changing activity type or search text to surface more events."
              />
            }
          />
        </EntityPanel>
      </div>
    </div>
  );
}

