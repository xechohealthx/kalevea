import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import {
  getClinicHealthSummary,
  getExecutiveSummary,
  getOperationalAlerts,
  getPAOpsSummary,
  getRevenueOpsSummary,
  getSupportOpsSummary,
} from "@/server/services/analytics/command-center.service";

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await getAccessSnapshot(session.user.id);
  const selectedOrganizationId =
    typeof searchParams.organizationId === "string" ? searchParams.organizationId : access.defaultOrganizationId ?? undefined;

  const organizations = await prisma.organization.findMany({
    where:
      access.globalRoleKeys.length > 0
        ? undefined
        : { id: { in: access.accessibleOrganizationIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [executive, alerts, clinicHealth, paOps, revenueOps, supportOps] = await Promise.all([
    getExecutiveSummary(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId },
      { organizationId: selectedOrganizationId },
    ),
    getOperationalAlerts(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId },
      { organizationId: selectedOrganizationId },
    ),
    getClinicHealthSummary(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId },
      { organizationId: selectedOrganizationId },
    ),
    getPAOpsSummary(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId },
      { organizationId: selectedOrganizationId },
    ),
    getRevenueOpsSummary(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId },
      { organizationId: selectedOrganizationId },
    ),
    getSupportOpsSummary(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId },
      { organizationId: selectedOrganizationId },
    ),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MSO Command Center</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Executive operations console for network health, PA throughput, and revenue execution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/kal?intent=operations&organizationId=${encodeURIComponent(selectedOrganizationId ?? "")}&screen=command-center&query=${encodeURIComponent("Explain this command center view and highlight the top operational risks.")}`}
            className="h-10 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Explain with Kal
          </Link>
          <form action="/command-center" method="get" className="flex items-center gap-2">
          <select
            name="organizationId"
            defaultValue={selectedOrganizationId ?? ""}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
            Filter
          </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Active clinics</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold tracking-tight">{executive.activeClinics}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Open PA cases</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold tracking-tight">{executive.openPACases}</div><p className="mt-1 text-xs text-zinc-500">Approval {executive.paApprovalRate.toFixed(1)}%</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total expected</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold tracking-tight">{money(executive.totalExpectedReimbursement)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Open variance</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold tracking-tight">{money(executive.totalOpenVariance)}</div><p className="mt-1 text-xs text-zinc-500">{executive.underpaidCaseCount} underpaid cases</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Operational alerts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{a.title}</div>
                <Badge variant={a.severity === "HIGH" ? "danger" : a.severity === "MEDIUM" ? "warning" : "outline"}>
                  {a.severity}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{a.description}</p>
            </div>
          ))}
          {alerts.length === 0 ? <p className="text-sm text-zinc-500">No operational alerts currently triggered.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Clinic health summary</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead><TableHead>Health</TableHead><TableHead>Risk</TableHead><TableHead>PA approval</TableHead><TableHead>Underpay</TableHead><TableHead>Avg payment lag</TableHead><TableHead>Open support</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clinicHealth.map((c) => (
                <TableRow key={c.clinicId}>
                  <TableCell className="font-medium">{c.clinicName}</TableCell>
                  <TableCell><Badge variant={c.healthBand === "AT_RISK" ? "danger" : c.healthBand === "WATCH" ? "warning" : "success"}>{c.healthBand}</Badge></TableCell>
                  <TableCell>{c.riskScore}</TableCell>
                  <TableCell>{c.paApprovalRate.toFixed(1)}%</TableCell>
                  <TableCell>{c.underpaymentRate.toFixed(1)}%</TableCell>
                  <TableCell>{c.avgDaysToPayment.toFixed(1)} days</TableCell>
                  <TableCell>{c.openSupport}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">PA operations</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Total PA cases: <span className="font-medium">{paOps.totalCases}</span></p>
            <p>Approval rate: <span className="font-medium">{paOps.approvalRate.toFixed(1)}%</span></p>
            <p>Pending backlog: <span className="font-medium">{paOps.pendingBacklog}</span></p>
            <p>Denied cases: <span className="font-medium">{paOps.deniedCount}</span></p>
            <p>Requiring action: <span className="font-medium">{paOps.requiringAction}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Revenue operations</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Total expected: <span className="font-medium">{money(revenueOps.totalExpected)}</span></p>
            <p>Total paid: <span className="font-medium">{money(revenueOps.totalPaid)}</span></p>
            <p>Open variance: <span className="font-medium">{money(revenueOps.totalOpenVariance)}</span></p>
            <p>Underpayment count: <span className="font-medium">{revenueOps.underpaymentCount}</span></p>
            <div className="pt-2">
              <p className="mb-1 font-medium">Top payer variance risk</p>
              <div className="space-y-1">
                {revenueOps.topPayersByVariance.slice(0, 5).map((row) => (
                  <div key={row.payerName} className="flex items-center justify-between text-xs">
                    <span>{row.payerName}</span><span>{money(row.variance)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Support & training operations</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <p>Open support tickets: <span className="font-medium">{supportOps.openTicketCount}</span></p>
          <p>Stale support tickets: <span className="font-medium">{supportOps.staleTicketCount}</span></p>
          <p>Urgent/high support tickets: <span className="font-medium">{supportOps.urgentTicketCount}</span></p>
          <p>Training completion rate: <span className="font-medium">{supportOps.trainingCompletionRate.toFixed(1)}%</span></p>
        </CardContent>
      </Card>
    </div>
  );
}
