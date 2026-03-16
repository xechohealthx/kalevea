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
import { getClinicRemsOverview } from "@/server/services/rems/rems.service";
import { ClinicEnrollmentEditor } from "@/components/rems/enrollment-editor";
import { RemsAttestDialog } from "@/components/rems/attest-dialog";
import { RemsClinicFilters } from "@/components/rems/rems-clinic-filters";

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

function normalizedEnrollment(status: string | null): string {
  return status ?? "NOT_ENROLLED";
}

export default async function ClinicRemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { clinicId } = await params;
  const data = await getClinicRemsOverview({ actorUserId: session.user.id }, clinicId);

  const providers = data.providers.map((p) => ({ id: p.providerId, name: p.name }));
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
  const providerQuery = getSingleSearchParam(searchParams?.pq).trim();
  const providerEnrollment = getSingleSearchParam(searchParams?.pe).toUpperCase() || "all";
  const activityQuery = getSingleSearchParam(searchParams?.aq).trim();
  const activityType = getSingleSearchParam(searchParams?.at).toUpperCase() || "all";
  const providerQueryLower = providerQuery.toLowerCase();
  const activityQueryLower = activityQuery.toLowerCase();

  const filteredProviders = data.providers.filter((provider) => {
    const matchesProviderQuery = !providerQuery
      ? true
      : provider.name.toLowerCase().includes(providerQueryLower);
    const enrollmentValue = normalizedEnrollment(provider.enrollmentStatus);
    const matchesEnrollment = providerEnrollment === "all" ? true : enrollmentValue === providerEnrollment;
    return matchesProviderQuery && matchesEnrollment;
  });

  const filteredActivity = data.activity.filter((event) => {
    const eventType = event.type.toUpperCase();
    const matchesType = activityType === "all" ? true : eventType === activityType;
    const searchable = `${event.title} ${event.description ?? ""} ${event.type}`.toLowerCase();
    const matchesQuery = !activityQuery ? true : searchable.includes(activityQueryLower);
    return matchesType && matchesQuery;
  });

  const activityTypes = Array.from(new Set(data.activity.map((event) => event.type))).sort();

  const requirementColumns: Array<EntityTableColumn<(typeof data.requirements)[number]>> = [
    {
      id: "appliesTo",
      header: "Applies to",
      cell: (row) => <StatusBadge label={row.appliesToType} tone="neutral" />,
    },
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
      cell: (row) => <StatusBadge label={row.isRequired ? "Required" : "Optional"} tone={row.isRequired ? "info" : "neutral"} />,
    },
    {
      id: "active",
      header: "Active",
      cell: (row) => <StatusBadge label={row.isActive ? "Active" : "Inactive"} tone={row.isActive ? "success" : "neutral"} />,
    },
  ];

  const providerColumns: Array<EntityTableColumn<(typeof data.providers)[number]>> = [
    {
      id: "provider",
      header: "Provider",
      cell: (row) => (
        <Link className="font-medium hover:underline" href={`/rems/providers/${row.providerId}`}>
          {row.name}
        </Link>
      ),
    },
    {
      id: "enrollment",
      header: "Enrollment",
      cell: (row) => <StatusBadge label={row.enrollmentStatus ?? "NOT_ENROLLED"} tone={toRemsTone(row.enrollmentStatus)} />,
    },
    {
      id: "expires",
      header: "Expires",
      cell: (row) => (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      id: "attestations",
      header: "Attestations (MVP)",
      cell: (row) => `${row.attested}/${row.attestable}`,
    },
  ];

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title={`${data.clinic.name} — REMS`}
        description="Clinic enrollment state, requirement readiness, provider compliance, and attestation activity."
        scopeLabel="Clinic workspace"
        meta={`Program: ${data.program.name}`}
        actions={
          <>
            <RemsAttestDialog
              clinicId={data.clinic.id}
              remsProgramId={data.program.id}
              requirements={requirementOptions}
              providers={providers}
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

      <RemsClinicFilters
        providerQuery={providerQuery}
        providerEnrollment={providerEnrollment}
        activityQuery={activityQuery}
        activityType={activityType}
        activityTypes={activityTypes}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Total requirements" value={data.readiness.totalRequirements} className="lg:col-span-1" />
        <MetricCard label="Attestable requirements" value={data.readiness.attestableRequirements} className="lg:col-span-1" />
        <MetricCard label="Attested (MVP)" value={data.readiness.attestedRequirements} className="lg:col-span-1" />
        <MetricCard
          label="Upcoming expirations (30d)"
          value={data.readiness.upcomingExpirations30d}
          trendLabel={data.readiness.upcomingExpirations30d > 0 ? "Follow-up required" : "No near-term expirations"}
          trendTone={data.readiness.upcomingExpirations30d > 0 ? "warning" : "success"}
          className="lg:col-span-1"
        />
        <MetricCard
          label="Expired enrollments"
          value={data.readiness.expiredEnrollments}
          trendLabel={data.readiness.expiredEnrollments > 0 ? "Action required" : "No expired enrollments"}
          trendTone={data.readiness.expiredEnrollments > 0 ? "danger" : "success"}
          className="lg:col-span-1"
        />
      </div>

      <EntityPanel
        title="Enrollment control"
        subtitle="Enrollment status and expiration governance for this clinic in the active REMS program."
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
        <ClinicEnrollmentEditor
          clinicId={data.clinic.id}
          remsProgramId={data.program.id}
          status={data.enrollment?.status ?? null}
          expiresAt={data.enrollment?.expiresAt ?? null}
        />
      </EntityPanel>

      <EntityPanel
        title="Requirements"
        subtitle="Current requirement catalog used to evaluate clinic/provider compliance."
      >
        <EntityTable
          columns={requirementColumns}
          rows={data.requirements}
          getRowKey={(row) => row.id}
          emptyState={
            <EmptyState
              title="No requirements configured"
              description="This REMS program currently has no active requirements in scope for this clinic."
            />
          }
        />
      </EntityPanel>

      <EntityPanel
        title="Provider compliance"
        subtitle="Enrollment readiness and attestation coverage across clinic providers."
      >
        <EntityTable
          columns={providerColumns}
          rows={filteredProviders}
          getRowKey={(row) => row.providerId}
          emptyState={
            <EmptyState
              title="No providers match current filters"
              description="Adjust provider search or enrollment filters to widen the compliance table."
            />
          }
        />
      </EntityPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <EntityPanel title="Attestations" subtitle="Most recent attestations recorded for clinic and provider requirements.">
          <Timeline
            items={data.attestations.map((attestation) => ({
              id: attestation.id,
              title: attestation.title,
              description: (
                <span>
                  {attestation.provider
                    ? `Provider: ${attestation.provider.firstName} ${attestation.provider.lastName}`
                    : "Clinic-level"}
                  {" · "}
                  Attested by {attestation.attestedBy.firstName} {attestation.attestedBy.lastName}
                  {attestation.notes ? ` · ${attestation.notes}` : ""}
                </span>
              ),
              meta: new Date(attestation.attestedAt).toLocaleString(),
            }))}
            emptyState={
              <EmptyState
                title="No attestations yet"
                description="Attestations will appear here once compliance confirmations are submitted."
              />
            }
          />
        </EntityPanel>

        <EntityPanel title="Activity" subtitle="Operational events captured for clinic enrollment status and updates.">
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
                description="Try changing activity type or search text to surface additional events."
              />
            }
          />
        </EntityPanel>
      </div>
    </div>
  );
}

