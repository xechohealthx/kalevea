import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRemsDashboard } from "@/server/services/rems/rems.service";

function StatusBadge({ status }: { status: string | null }) {
  const v: BadgeProps["variant"] =
    status === "ENROLLED"
      ? "success"
      : status === "PENDING"
        ? "warning"
        : status === "EXPIRED"
          ? "danger"
          : status === "SUSPENDED"
            ? "secondary"
            : "outline";
  return <Badge variant={v}>{status ?? "—"}</Badge>;
}

function MetricCard(props: { title: string; value: string | number; subtitle?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {props.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{props.value}</div>
        {props.subtitle ? (
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {props.subtitle}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function RemsIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dashboard = await getRemsDashboard({ actorUserId: session.user.id });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">REMS</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Compliance readiness and attestations (MVP engine).
          </p>
        </div>
        <Badge variant="secondary">{dashboard.program.name}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Clinics" value={dashboard.clinics.length} />
        <MetricCard title="Requirements" value={dashboard.summary.totalRequirements} />
        <MetricCard title="Upcoming expirations (30d)" value={dashboard.summary.upcomingExpirations30d} />
        <MetricCard title="Expired enrollments" value={dashboard.summary.expiredEnrollments} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Clinic readiness</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>Enrollment</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Clinic attestations</TableHead>
                <TableHead>Provider attestations</TableHead>
                <TableHead>Overall</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.clinics.map((c) => {
                const denom = c.clinicAttestableCount + c.providerAttestableCount;
                const numer = c.clinicAttestedCount + c.providerAttestedCount;
                const pct = denom > 0 ? Math.round((numer / denom) * 100) : 0;
                return (
                  <TableRow key={c.clinicId}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={`/rems/clinics/${c.clinicId}`}>
                        {c.clinicName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {c.clinicAttestedCount}/{c.clinicAttestableCount}
                    </TableCell>
                    <TableCell>
                      {c.providerAttestedCount}/{c.providerAttestableCount}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pct === 100 ? "success" : pct >= 60 ? "warning" : "secondary"}>
                        {pct}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {dashboard.clinics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-zinc-500">
                    No clinics available.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Upcoming expirations (30d)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.upcomingExpirations.map((e) => (
              <div
                key={`${e.kind}:${e.clinicId}:${e.providerId ?? "none"}:${e.expiresAt.toISOString()}`}
                className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div>
                  <div className="text-sm font-medium">
                    {e.kind === "CLINIC" ? "Clinic enrollment" : "Provider enrollment"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {e.clinicName}
                    {e.providerName ? ` · ${e.providerName}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{e.expiresAt.toLocaleDateString()}</div>
                  <div className="mt-1">
                    <Badge variant="outline">{e.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
            {dashboard.upcomingExpirations.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                No upcoming expirations in the next 30 days.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Provider compliance snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Attestations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.providerSnapshot.map((p) => (
                  <TableRow key={p.providerId}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={`/rems/providers/${p.providerId}`}>
                        {p.providerName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                      {p.clinicName}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.enrollmentStatus} />
                    </TableCell>
                    <TableCell>
                      {p.attested}/{p.attestable}
                    </TableCell>
                  </TableRow>
                ))}
                {dashboard.providerSnapshot.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-zinc-500">
                      No providers available.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

