import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import {
  getAuthorizationBenchmarkSummary,
  getClinicBenchmarkSummary,
  getPayerBenchmarkSummary,
  getPaymentTimelineBenchmark,
} from "@/server/services/analytics/network-benchmark.service";

function formatAmount(value: number) {
  return `$${value.toFixed(2)}`;
}

function PercentBar({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 rounded bg-zinc-200 dark:bg-zinc-800">
        <div className="h-2 rounded bg-zinc-900 dark:bg-zinc-100" style={{ width: `${safe}%` }} />
      </div>
      <span className="text-xs tabular-nums text-zinc-500">{safe.toFixed(1)}%</span>
    </div>
  );
}

export default async function NetworkAnalyticsPage({
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

  const [clinicRows, payerRows, authSummary, paymentTimelineRows] = await Promise.all([
    getClinicBenchmarkSummary(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId },
      { organizationId: selectedOrganizationId },
    ),
    getPayerBenchmarkSummary(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId },
      { organizationId: selectedOrganizationId, limit: 25 },
    ),
    getAuthorizationBenchmarkSummary(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId },
      { organizationId: selectedOrganizationId },
    ),
    getPaymentTimelineBenchmark(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId },
      { organizationId: selectedOrganizationId },
    ),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Network Benchmarking</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Cross-clinic benchmarking for reimbursement, payer performance, PA approvals, and payment timelines.
          </p>
        </div>
        <form action="/analytics/network" method="get" className="flex items-center gap-2">
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Clinic comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>Treatments</TableHead>
                <TableHead>Avg reimbursement</TableHead>
                <TableHead>Avg days to payment</TableHead>
                <TableHead>PA approval rate</TableHead>
                <TableHead>Underpayment rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clinicRows.map((row) => (
                <TableRow key={row.clinicId}>
                  <TableCell className="font-medium">{row.clinicName}</TableCell>
                  <TableCell>{row.treatmentCount}</TableCell>
                  <TableCell>{formatAmount(row.avgReimbursementPerTreatment)}</TableCell>
                  <TableCell>{row.avgDaysToPayment.toFixed(1)} days</TableCell>
                  <TableCell><PercentBar value={row.paApprovalRate} /></TableCell>
                  <TableCell><PercentBar value={row.underpaymentRate} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payer comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payer</TableHead>
                <TableHead>Cases</TableHead>
                <TableHead>Clinics</TableHead>
                <TableHead>Total paid</TableHead>
                <TableHead>Total variance</TableHead>
                <TableHead>Avg days</TableHead>
                <TableHead>Underpayment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payerRows.map((row) => (
                <TableRow key={row.payerName}>
                  <TableCell className="font-medium">{row.payerName}</TableCell>
                  <TableCell>{row.caseCount}</TableCell>
                  <TableCell>{row.clinicCount}</TableCell>
                  <TableCell>{formatAmount(row.totalPaid)}</TableCell>
                  <TableCell>{formatAmount(row.totalVariance)}</TableCell>
                  <TableCell>{row.avgDaysToPayment.toFixed(1)} days</TableCell>
                  <TableCell><PercentBar value={row.underpaymentRate} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">PA approval rate by clinic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {authSummary.clinicRows.map((row) => (
              <div key={row.clinicId} className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{row.clinicName}</div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-zinc-500">PA: {row.totalPA}</span>
                  <PercentBar value={row.approvalRate} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment timeline by clinic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentTimelineRows.map((row) => (
              <div key={row.clinicId} className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <div className="font-medium">{row.clinicName}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Avg {row.avgDaysToPayment.toFixed(1)}d · Median {row.medianDaysToPayment.toFixed(1)}d · P90{" "}
                  {row.p90DaysToPayment.toFixed(1)}d
                </div>
                <div className="mt-2">
                  <PercentBar value={row.paidWithin30DaysRate} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
