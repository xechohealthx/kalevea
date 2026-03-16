import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import {
  getClinicReimbursementSummary,
  getNetworkReimbursementSummary,
  getPayerPerformanceSummary,
  listUnderpaidCases,
} from "@/server/services/analytics/reimbursement-analytics.service";

function formatAmount(value: number) {
  return `$${value.toFixed(2)}`;
}

export default async function ReimbursementAnalyticsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const selectedClinicId = typeof searchParams.clinicId === "string" ? searchParams.clinicId : undefined;
  const access = await getAccessSnapshot(session.user.id);
  const clinics = await prisma.clinic.findMany({
    where: { id: { in: access.accessibleClinicIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [network, clinicRows, payerRows, underpaidRows] = await Promise.all([
    getNetworkReimbursementSummary({ actorUserId: session.user.id }, { clinicId: selectedClinicId }),
    getClinicReimbursementSummary({ actorUserId: session.user.id }, { clinicId: selectedClinicId }),
    getPayerPerformanceSummary(
      { actorUserId: session.user.id },
      { clinicId: selectedClinicId, limit: 25 },
    ),
    listUnderpaidCases({ actorUserId: session.user.id }, { clinicId: selectedClinicId, limit: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reimbursement Analytics</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Underpayment detection and network-level reimbursement performance.
          </p>
        </div>
        <form action="/analytics/reimbursement" method="get" className="flex items-center gap-2">
          <select
            name="clinicId"
            defaultValue={selectedClinicId ?? ""}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">All accessible clinics</option>
            {clinics.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </select>
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
            Filter
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{network.totalCases}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total expected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{formatAmount(network.totalExpected)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{formatAmount(network.totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Variance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{formatAmount(network.totalVariance)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Underpayment rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{network.underpaymentRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payer performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payer</TableHead>
                  <TableHead>Claims</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Underpay %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payerRows.map((payer) => (
                  <TableRow key={payer.payerName}>
                    <TableCell className="font-medium">{payer.payerName}</TableCell>
                    <TableCell>{payer.totalClaims}</TableCell>
                    <TableCell>{formatAmount(payer.totalExpected)}</TableCell>
                    <TableCell>{formatAmount(payer.totalPaid)}</TableCell>
                    <TableCell>{formatAmount(payer.totalVariance)}</TableCell>
                    <TableCell>{payer.underpaymentRate.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Clinic performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Cases</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Underpaid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clinicRows.map((clinic) => (
                  <TableRow key={clinic.clinicId}>
                    <TableCell className="font-medium">{clinic.clinicName}</TableCell>
                    <TableCell>{clinic.totalCases}</TableCell>
                    <TableCell>{formatAmount(clinic.totalExpected)}</TableCell>
                    <TableCell>{formatAmount(clinic.totalPaid)}</TableCell>
                    <TableCell>{formatAmount(clinic.totalVariance)}</TableCell>
                    <TableCell>{clinic.underpaidCaseCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Potential underpaid cases</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case</TableHead>
                <TableHead>Clinic</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {underpaidRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.id.slice(0, 12)}...</TableCell>
                  <TableCell>{row.clinic.name}</TableCell>
                  <TableCell>{row.payerName}</TableCell>
                  <TableCell>{formatAmount(row.expectedAmount)}</TableCell>
                  <TableCell>{formatAmount(row.totalPaid)}</TableCell>
                  <TableCell>{formatAmount(row.varianceAmount)}</TableCell>
                  <TableCell>
                    <Badge variant="warning">{row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {underpaidRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-zinc-500">
                    No underpaid cases detected for this scope.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
