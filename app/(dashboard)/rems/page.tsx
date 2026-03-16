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
import { RemsDashboardFilters } from "@/components/rems/rems-dashboard-filters";
import { getRemsDashboard } from "@/server/services/rems/rems.service";

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

function getClinicReadinessPercent(clinic: {
  clinicAttestedCount: number;
  providerAttestedCount: number;
  clinicAttestableCount: number;
  providerAttestableCount: number;
}): number {
  const denom = clinic.clinicAttestableCount + clinic.providerAttestableCount;
  const numer = clinic.clinicAttestedCount + clinic.providerAttestedCount;
  return denom > 0 ? Math.round((numer / denom) * 100) : 0;
}

function isUpcomingWithin30Days(dateValue: Date | string | null): boolean {
  if (!dateValue) return false;
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + 30);
  return date >= now && date <= cutoff;
}

function isExpiredDate(dateValue: Date | string | null): boolean {
  if (!dateValue) return false;
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return date < new Date();
}

export default async function RemsIndexPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dashboard = await getRemsDashboard({ actorUserId: session.user.id });
  const query = getSingleSearchParam(searchParams?.q).trim();
  const enrollment = getSingleSearchParam(searchParams?.enrollment).toUpperCase() || "all";
  const readiness = getSingleSearchParam(searchParams?.readiness).toLowerCase() || "all";
  const expiration = getSingleSearchParam(searchParams?.expiration).toLowerCase() || "all";
  const queryLower = query.toLowerCase();

  const filteredClinics = dashboard.clinics.filter((clinic) => {
    const matchesQuery = !query
      ? true
      : clinic.clinicName.toLowerCase().includes(queryLower);
    const enrollmentValue = normalizedEnrollment(clinic.status);
    const matchesEnrollment = enrollment === "all" ? true : enrollmentValue === enrollment;
    const readinessPct = getClinicReadinessPercent(clinic);
    const matchesReadiness =
      readiness === "all" ||
      (readiness === "complete" && readinessPct === 100) ||
      (readiness === "watch" && readinessPct >= 60 && readinessPct < 100) ||
      (readiness === "at-risk" && readinessPct < 60);
    const matchesExpiration =
      expiration === "all" ||
      (expiration === "upcoming" && isUpcomingWithin30Days(clinic.expiresAt)) ||
      (expiration === "expired" &&
        (normalizedEnrollment(clinic.status) === "EXPIRED" || isExpiredDate(clinic.expiresAt)));

    return matchesQuery && matchesEnrollment && matchesReadiness && matchesExpiration;
  });

  const filteredClinicIds = new Set(filteredClinics.map((clinic) => clinic.clinicId));

  const filteredProviders = dashboard.providerSnapshot.filter((provider) => {
    const matchesClinicFilter = filteredClinicIds.size === 0 ? false : filteredClinicIds.has(provider.clinicId);
    if (!matchesClinicFilter) return false;
    const matchesQuery = !query
      ? true
      : provider.providerName.toLowerCase().includes(queryLower) ||
        provider.clinicName.toLowerCase().includes(queryLower);
    const providerEnrollment = normalizedEnrollment(provider.enrollmentStatus);
    const matchesEnrollment = enrollment === "all" ? true : providerEnrollment === enrollment;
    const matchesExpiration =
      expiration === "all" ||
      (expiration === "upcoming" && isUpcomingWithin30Days(provider.expiresAt)) ||
      (expiration === "expired" &&
        (providerEnrollment === "EXPIRED" || isExpiredDate(provider.expiresAt)));

    return matchesQuery && matchesEnrollment && matchesExpiration;
  });

  const filteredUpcomingExpirations = dashboard.upcomingExpirations.filter((expirationRow) => {
    if (!filteredClinicIds.has(expirationRow.clinicId)) return false;
    if (!query) return true;
    const combined = `${expirationRow.clinicName} ${expirationRow.providerName ?? ""}`.toLowerCase();
    return combined.includes(queryLower);
  });

  const totalAttested = filteredClinics.reduce(
    (acc, clinic) => acc + clinic.clinicAttestedCount + clinic.providerAttestedCount,
    0,
  );
  const totalAttestable = filteredClinics.reduce(
    (acc, clinic) => acc + clinic.clinicAttestableCount + clinic.providerAttestableCount,
    0,
  );
  const networkReadinessPct = totalAttestable > 0 ? Math.round((totalAttested / totalAttestable) * 100) : 0;

  const clinicColumns: Array<EntityTableColumn<(typeof dashboard.clinics)[number]>> = [
    {
      id: "clinic",
      header: "Clinic",
      cell: (row) => (
        <Link className="font-medium hover:underline" href={`/rems/clinics/${row.clinicId}`}>
          {row.clinicName}
        </Link>
      ),
    },
    {
      id: "enrollment",
      header: "Enrollment",
      cell: (row) => (
        <StatusBadge
          label={row.status ?? "NOT_ENROLLED"}
          tone={toRemsTone(row.status)}
        />
      ),
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
      id: "clinicAtt",
      header: "Clinic attestations",
      cell: (row) => `${row.clinicAttestedCount}/${row.clinicAttestableCount}`,
    },
    {
      id: "providerAtt",
      header: "Provider attestations",
      cell: (row) => `${row.providerAttestedCount}/${row.providerAttestableCount}`,
    },
    {
      id: "overall",
      header: "Overall",
      cell: (row) => {
        const denom = row.clinicAttestableCount + row.providerAttestableCount;
        const numer = row.clinicAttestedCount + row.providerAttestedCount;
        const pct = denom > 0 ? Math.round((numer / denom) * 100) : 0;
        return (
          <StatusBadge
            label={`${pct}%`}
            tone={pct === 100 ? "success" : pct >= 60 ? "warning" : "neutral"}
          />
        );
      },
    },
  ];

  const providerColumns: Array<EntityTableColumn<(typeof dashboard.providerSnapshot)[number]>> = [
    {
      id: "provider",
      header: "Provider",
      cell: (row) => (
        <Link className="font-medium hover:underline" href={`/rems/providers/${row.providerId}`}>
          {row.providerName}
        </Link>
      ),
    },
    {
      id: "clinic",
      header: "Clinic",
      cell: (row) => <span className="text-sm text-zinc-600 dark:text-zinc-400">{row.clinicName}</span>,
    },
    {
      id: "status",
      header: "Enrollment",
      cell: (row) => (
        <StatusBadge
          label={row.enrollmentStatus ?? "NOT_ENROLLED"}
          tone={toRemsTone(row.enrollmentStatus)}
        />
      ),
    },
    {
      id: "attestations",
      header: "Attestations",
      cell: (row) => `${row.attested}/${row.attestable}`,
    },
  ];

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="REMS"
        description="Compliance readiness, enrollment status, attestations, and expiration risk across the network."
        scopeLabel="Compliance workspace"
        meta={`Program: ${dashboard.program.name}`}
        actions={<StatusBadge label={dashboard.program.name} tone="info" />}
      />

      <FilterBar
        left={
          <>
            <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
              Rolling window
            </Badge>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Upcoming expiration horizon: 30 days</span>
          </>
        }
        right={
          <>
            <StatusBadge
              label={`${filteredClinics.length}/${dashboard.clinics.length} clinics in scope`}
              tone="neutral"
            />
            <StatusBadge label={`Network readiness ${networkReadinessPct}%`} tone="info" />
          </>
        }
      />

      <RemsDashboardFilters
        query={query}
        enrollment={enrollment}
        readiness={readiness}
        expiration={expiration}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Clinics" value={filteredClinics.length} />
        <MetricCard label="Requirements" value={dashboard.summary.totalRequirements} />
        <MetricCard
          label="Upcoming expirations (30d)"
          value={filteredUpcomingExpirations.length}
          trendLabel={filteredUpcomingExpirations.length > 0 ? "Monitor closely" : "No upcoming risk"}
          trendTone={filteredUpcomingExpirations.length > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Expired enrollments"
          value={
            filteredClinics.filter((clinic) => normalizedEnrollment(clinic.status) === "EXPIRED").length +
            filteredProviders.filter((provider) => normalizedEnrollment(provider.enrollmentStatus) === "EXPIRED")
              .length
          }
          trendLabel={
            filteredClinics.some((clinic) => normalizedEnrollment(clinic.status) === "EXPIRED") ||
            filteredProviders.some((provider) => normalizedEnrollment(provider.enrollmentStatus) === "EXPIRED")
              ? "Action needed"
              : "In good standing"
          }
          trendTone={
            filteredClinics.some((clinic) => normalizedEnrollment(clinic.status) === "EXPIRED") ||
            filteredProviders.some((provider) => normalizedEnrollment(provider.enrollmentStatus) === "EXPIRED")
              ? "danger"
              : "success"
          }
        />
      </div>

      <EntityPanel title="Clinic readiness" subtitle="Enrollment state, expiration timing, and attestation completion by clinic.">
        <EntityTable
          columns={clinicColumns}
          rows={filteredClinics}
          getRowKey={(row) => row.clinicId}
          emptyState={
            <EmptyState
              title="No clinics match current filters"
              description="Adjust enrollment, readiness, expiration, or search filters to broaden results."
            />
          }
        />
      </EntityPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <EntityPanel title="Upcoming expirations (30d)" subtitle="Most urgent enrollment renewals requiring proactive follow-up.">
          <Timeline
            items={filteredUpcomingExpirations.map((exp) => ({
              id: `${exp.kind}:${exp.clinicId}:${exp.providerId ?? "none"}:${exp.expiresAt.toISOString()}`,
              title: exp.kind === "CLINIC" ? "Clinic enrollment expiration" : "Provider enrollment expiration",
              description: (
                <span>
                  {exp.clinicName}
                  {exp.providerName ? ` · ${exp.providerName}` : ""}
                </span>
              ),
              meta: (
                <span className="inline-flex items-center gap-2">
                  {exp.expiresAt.toLocaleDateString()}
                  <StatusBadge label={exp.status} tone={toRemsTone(exp.status)} />
                </span>
              ),
            }))}
            emptyState={
              <EmptyState
                title="No upcoming expirations in filtered view"
                description="No clinic or provider enrollments match the current filter scope."
              />
            }
          />
        </EntityPanel>

        <EntityPanel title="Provider compliance snapshot" subtitle="Quick view of provider enrollment and attestation completion.">
          <EntityTable
            columns={providerColumns}
            rows={filteredProviders}
            getRowKey={(row) => row.providerId}
            emptyState={
              <EmptyState
                title="No providers match current filters"
                description="Try widening clinic, enrollment, expiration, or text search filters."
              />
            }
          />
        </EntityPanel>
      </div>
    </div>
  );
}

