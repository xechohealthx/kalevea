import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import {
  generatePredictiveSignals,
  listPredictiveSignals,
  predictClinicOperationalRisk,
  predictExpectedRevenue,
  predictPaymentTimeline,
  predictUnderpaymentRisk,
} from "@/server/services/analytics/predictive-analytics.service";

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export default async function PredictiveAnalyticsPage({
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

  if (!selectedOrganizationId) redirect("/dashboard");

  if (refresh) {
    await generatePredictiveSignals(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId, clinicId: selectedClinicId },
      { organizationId: selectedOrganizationId, clinicId: selectedClinicId },
    );
  }

  const organizations = await prisma.organization.findMany({
    where: access.globalRoleKeys.length > 0 ? undefined : { id: { in: access.accessibleOrganizationIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const clinics = await prisma.clinic.findMany({
    where: { organizationId: selectedOrganizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [revenueForecast, paymentRisk, clinicRisk, payerRisk, signals] = await Promise.all([
    predictExpectedRevenue(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId, clinicId: selectedClinicId },
      { organizationId: selectedOrganizationId, clinicId: selectedClinicId },
    ),
    predictPaymentTimeline(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId, clinicId: selectedClinicId },
      { organizationId: selectedOrganizationId, clinicId: selectedClinicId },
    ),
    predictClinicOperationalRisk(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId, clinicId: selectedClinicId },
      { organizationId: selectedOrganizationId, clinicId: selectedClinicId },
    ),
    predictUnderpaymentRisk(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId, clinicId: selectedClinicId },
      { organizationId: selectedOrganizationId, clinicId: selectedClinicId },
    ),
    listPredictiveSignals(
      { actorUserId: session.user.id, organizationId: selectedOrganizationId, clinicId: selectedClinicId },
      { organizationId: selectedOrganizationId, clinicId: selectedClinicId, limit: 50 },
    ),
  ]);

  const highSignals = signals.filter((signal) => signal.confidenceScore >= 75).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Predictive Analytics</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Deterministic operational forecasting across revenue, payment timelines, clinic risk, and payer patterns.
          </p>
        </div>
        <form action="/analytics/predictive" method="get" className="flex items-center gap-2">
          <select
            name="organizationId"
            defaultValue={selectedOrganizationId}
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
            Refresh predictions
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Predicted revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{money(revenueForecast.totalForecast)}</div>
            <p className="mt-1 text-xs text-zinc-500">Delta {revenueForecast.deltaPct.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">High-confidence signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{highSignals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Payment delay risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">
              {paymentRisk.filter((row) => row.riskBand !== "LOW").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">At-risk clinics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">
              {clinicRisk.filter((row) => row.projectedHealthBand !== "HEALTHY").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Predicted payment timelines</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Predicted days</TableHead>
                  <TableHead>Delta</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRisk.map((row) => (
                  <TableRow key={row.clinicId}>
                    <TableCell className="font-medium">{row.clinicName}</TableCell>
                    <TableCell>{row.predictedDaysToPayment.toFixed(1)} days</TableCell>
                    <TableCell>{row.riskDeltaPct.toFixed(1)}%</TableCell>
                    <TableCell>{row.confidenceScore.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Predicted payer underpayment risk</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payer</TableHead>
                  <TableHead>Predicted underpay</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payerRisk.map((row) => (
                  <TableRow key={row.payerName}>
                    <TableCell className="font-medium">{row.payerName}</TableCell>
                    <TableCell>{row.predictedUnderpaymentRate.toFixed(1)}%</TableCell>
                    <TableCell>{row.variancePct.toFixed(1)}%</TableCell>
                    <TableCell>{row.confidenceScore.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Clinic operational forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Projected risk</TableHead>
                  <TableHead>Health band</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clinicRisk.map((row) => (
                  <TableRow key={row.clinicId}>
                    <TableCell className="font-medium">{row.clinicName}</TableCell>
                    <TableCell>{row.projectedRiskScore.toFixed(1)}</TableCell>
                    <TableCell>
                      <Badge variant={row.projectedHealthBand === "AT_RISK" ? "danger" : row.projectedHealthBand === "WATCH" ? "warning" : "success"}>
                        {row.projectedHealthBand}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.confidenceScore.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Generated predictive signals</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signal</TableHead>
                  <TableHead>Clinic/Payer</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((signal) => (
                  <TableRow key={signal.id}>
                    <TableCell className="font-medium">{signal.signalType}</TableCell>
                    <TableCell>{signal.clinic?.name ?? signal.payerName ?? "Network"}</TableCell>
                    <TableCell>{signal.predictedOutcome}</TableCell>
                    <TableCell>{signal.confidenceScore.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {signals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-zinc-500">
                      No predictive signals generated yet.
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
