import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import {
  forecastExpectedReimbursement,
  generateRevenueOptimizationSignals,
  getRevenueOpportunities,
  listRevenueOptimizationSignals,
} from "@/server/services/analytics/revenue-optimization.service";

function formatAmount(value: number) {
  return `$${value.toFixed(2)}`;
}

function severityVariant(severity: string): BadgeProps["variant"] {
  if (severity === "CRITICAL") return "danger";
  if (severity === "HIGH") return "warning";
  if (severity === "MEDIUM") return "secondary";
  return "outline";
}

export default async function RevenueAnalyticsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await getAccessSnapshot(session.user.id);
  const selectedOrganizationId =
    typeof searchParams.organizationId === "string" ? searchParams.organizationId : access.defaultOrganizationId ?? undefined;
  const selectedClinicId = typeof searchParams.clinicId === "string" ? searchParams.clinicId : undefined;
  const refresh = searchParams.refresh === "1";

  if (refresh && selectedOrganizationId) {
    await generateRevenueOptimizationSignals(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId, clinicId: selectedClinicId },
      { organizationId: selectedOrganizationId, clinicId: selectedClinicId },
    );
  }

  const organizations = await prisma.organization.findMany({
    where:
      access.globalRoleKeys.length > 0
        ? undefined
        : { id: { in: access.accessibleOrganizationIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const clinics = await prisma.clinic.findMany({
    where: selectedOrganizationId ? { organizationId: selectedOrganizationId } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [signals, opportunities, forecastRows] = await Promise.all([
    listRevenueOptimizationSignals(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId, clinicId: selectedClinicId },
      { organizationId: selectedOrganizationId, clinicId: selectedClinicId, limit: 100 },
    ),
    getRevenueOpportunities(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId, clinicId: selectedClinicId },
      { organizationId: selectedOrganizationId, clinicId: selectedClinicId, limit: 25 },
    ),
    forecastExpectedReimbursement(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId, clinicId: selectedClinicId },
      { organizationId: selectedOrganizationId, clinicId: selectedClinicId, limit: 25 },
    ),
  ]);

  const criticalSignals = signals.filter((s) => s.signalSeverity === "CRITICAL").length;
  const highSignals = signals.filter((s) => s.signalSeverity === "HIGH").length;
  const appealCount = opportunities.appealCandidates.length;
  const highValueRisk = opportunities.appealCandidates
    .filter((row) => row.severity === "HIGH" || row.severity === "CRITICAL")
    .reduce((acc, row) => acc + row.valueAtRisk, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Revenue Optimization</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Decision-support signals for appeal triage, payer variance trends, and reimbursement forecasting.
          </p>
        </div>
        <form action="/analytics/revenue" method="get" className="flex items-center gap-2">
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
          <select
            name="clinicId"
            defaultValue={selectedClinicId ?? ""}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">All clinics</option>
            {clinics.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </select>
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
            Filter
          </button>
          <button
            name="refresh"
            value="1"
            className="h-10 rounded-md border border-zinc-200 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Refresh signals
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{signals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Critical risk signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{criticalSignals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Appeal candidates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{appealCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">High-value risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{formatAmount(highValueRisk)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Optimization signals</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Recommended action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((signal) => (
                  <TableRow key={signal.id}>
                    <TableCell className="font-medium">{signal.signalType}</TableCell>
                    <TableCell>
                      <Badge variant={severityVariant(signal.signalSeverity)}>{signal.signalSeverity}</Badge>
                    </TableCell>
                    <TableCell>{signal.payerName ?? "N/A"}</TableCell>
                    <TableCell>{signal.clinic?.name ?? "Network"}</TableCell>
                    <TableCell className="max-w-[360px] text-sm text-zinc-600 dark:text-zinc-300">
                      {signal.recommendedAction}
                    </TableCell>
                  </TableRow>
                ))}
                {signals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-zinc-500">
                      No optimization signals yet. Use Refresh signals to generate the current opportunity set.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Appeal opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Claim status</TableHead>
                  <TableHead>Value at risk</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.appealCandidates.map((row) => (
                  <TableRow key={row.claimId}>
                    <TableCell className="font-medium">{row.clinic.name}</TableCell>
                    <TableCell>{row.payerName}</TableCell>
                    <TableCell>{row.claimStatus}</TableCell>
                    <TableCell>{formatAmount(row.valueAtRisk)}</TableCell>
                    <TableCell>
                      <Badge variant={severityVariant(row.severity)}>{row.severity}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {opportunities.appealCandidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-zinc-500">
                      No appeal opportunities identified for this scope.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payer variance patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payer</TableHead>
                  <TableHead>Cases</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Underpay %</TableHead>
                  <TableHead>Signal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.payerVariancePatterns.map((row) => (
                  <TableRow key={row.payerName}>
                    <TableCell className="font-medium">{row.payerName}</TableCell>
                    <TableCell>{row.caseCount}</TableCell>
                    <TableCell>{formatAmount(row.variance)}</TableCell>
                    <TableCell>{row.underpaymentRate.toFixed(1)}%</TableCell>
                    <TableCell>
                      <Badge variant={severityVariant(row.severity)}>{row.severity}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Forecast summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Forecast</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecastRows.map((row) => (
                  <TableRow key={row.reimbursementCaseId}>
                    <TableCell className="font-medium">{row.clinic.name}</TableCell>
                    <TableCell>{row.payerName}</TableCell>
                    <TableCell>{formatAmount(row.expectedAmount)}</TableCell>
                    <TableCell>{formatAmount(row.forecastAmount)}</TableCell>
                    <TableCell>
                      <span className={row.forecastRiskPct < 0 ? "text-red-600 dark:text-red-400" : ""}>
                        {row.forecastRiskPct.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {forecastRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-zinc-500">
                      No open reimbursement cases available for forecasting.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {highSignals > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Operator guidance</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600 dark:text-zinc-300">
            {highSignals} high-severity signals are active. Prioritize appeal triage and payer variance review to reduce short-term
            revenue leakage.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
