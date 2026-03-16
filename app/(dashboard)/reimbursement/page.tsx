import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import {
  getReimbursementCase,
  listReimbursementCases,
} from "@/server/services/reimbursement/reimbursement.service";
import { CreateReimbursementCaseDialog } from "@/components/reimbursement/create-reimbursement-case-dialog";
import { UpdateReimbursementStatusForm } from "@/components/reimbursement/update-reimbursement-status-form";
import { CreateClaimRecordForm } from "@/components/reimbursement/create-claim-record-form";
import { CreatePaymentRecordForm } from "@/components/reimbursement/create-payment-record-form";
import { getExpectedReimbursementGuidance } from "@/server/services/payer-rules/payer-rule.service";

function statusVariant(status: string): BadgeProps["variant"] {
  if (status === "PAID" || status === "CLOSED") return "success";
  if (status === "DENIED") return "danger";
  if (
    status === "SUBMITTED" ||
    status === "PENDING_PAYMENT" ||
    status === "PARTIALLY_PAID" ||
    status === "APPEAL_NEEDED"
  ) {
    return "warning";
  }
  return "outline";
}

export default async function ReimbursementPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const selectedCaseId = typeof searchParams.caseId === "string" ? searchParams.caseId : undefined;
  const selectedClinicId = typeof searchParams.clinicId === "string" ? searchParams.clinicId : undefined;

  const access = await getAccessSnapshot(session.user.id);
  const clinics = await prisma.clinic.findMany({
    where: { id: { in: access.accessibleClinicIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [buyAndBillCases, priorAuthCases, reimbursementCases] = await Promise.all([
    prisma.buyAndBillCase.findMany({
      where: { clinicId: { in: access.accessibleClinicIds } },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.priorAuthorizationCase.findMany({
      where: { clinicId: { in: access.accessibleClinicIds } },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    listReimbursementCases(
      { actorUserId: session.user.id },
      { clinicId: selectedClinicId, limit: 100 },
    ),
  ]);

  const activeCaseId = selectedCaseId ?? reimbursementCases[0]?.id;
  const selectedCase = activeCaseId
    ? await getReimbursementCase({ actorUserId: session.user.id }, activeCaseId)
    : null;
  const payerGuidance = selectedCase
    ? await getExpectedReimbursementGuidance(
        { actorUserId: session.user.id },
        {
          organizationId: selectedCase.organizationId,
          clinicId: selectedCase.clinicId,
          payerName: selectedCase.payerName,
          serviceContext: "reimbursement",
        },
      )
    : null;

  const totalExpected = reimbursementCases.reduce((acc, c) => acc + c.expectedAmount, 0);
  const totalPaid = reimbursementCases.reduce((acc, c) => acc + c.totalPaid, 0);
  const totalOpenVariance = reimbursementCases.reduce((acc, c) => acc + c.variance, 0);
  const pendingPaymentCount = reimbursementCases.filter((c) =>
    ["SUBMITTED", "PENDING_PAYMENT", "PARTIALLY_PAID"].includes(c.status),
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reimbursement Intelligence</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Expected vs paid visibility with claim and payment tracking foundation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/kal?intent=reimbursement${selectedClinicId ? `&clinicId=${encodeURIComponent(selectedClinicId)}` : ""}&screen=reimbursement&query=${encodeURIComponent("Explain reimbursement variance, underpayment drivers, and immediate billing actions.")}`}
            className="h-10 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Explain with Kal
          </Link>
          <CreateReimbursementCaseDialog
            clinics={clinics}
            buyAndBillCases={buyAndBillCases}
            priorAuthCases={priorAuthCases}
            selectedClinicId={selectedClinicId}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total expected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">${totalExpected.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">${totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Open variance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">${totalOpenVariance.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Pending payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{pendingPaymentCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reimbursement cases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action="/reimbursement" method="get" className="flex justify-end">
            <select
              name="clinicId"
              defaultValue={selectedClinicId ?? ""}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All accessible clinics</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="ml-2 h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
              Filter
            </button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case</TableHead>
                <TableHead>Clinic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reimbursementCases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link className="hover:underline" href={`/reimbursement?caseId=${c.id}`}>
                      {c.id.slice(0, 10)}...
                    </Link>
                  </TableCell>
                  <TableCell>{c.clinic.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>{c.payerName}</TableCell>
                  <TableCell>${c.expectedAmount.toFixed(2)}</TableCell>
                  <TableCell>${c.totalPaid.toFixed(2)}</TableCell>
                  <TableCell>${c.variance.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {reimbursementCases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-zinc-500">
                    No reimbursement cases found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedCase ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Case detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-zinc-500">Case ID:</span> {selectedCase.id}
              </div>
              <div>
                <span className="text-zinc-500">Status:</span>{" "}
                <Badge variant={statusVariant(selectedCase.status)}>{selectedCase.status}</Badge>
              </div>
              <div>
                <span className="text-zinc-500">Payer:</span> {selectedCase.payerName}
              </div>
              <div>
                <span className="text-zinc-500">Expected:</span> ${selectedCase.expectedAmount.toFixed(2)}
              </div>
              <div>
                <span className="text-zinc-500">Total paid:</span> ${selectedCase.totalPaid.toFixed(2)}
              </div>
              <div>
                <span className="text-zinc-500">Variance:</span> ${selectedCase.variance.toFixed(2)}
              </div>
              <div>
                <span className="text-zinc-500">Linked buy-and-bill:</span> {selectedCase.buyAndBillCaseId ?? "—"}
              </div>
              <div>
                <span className="text-zinc-500">Linked prior auth:</span> {selectedCase.priorAuthorizationCaseId ?? "—"}
              </div>
              <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <h3 className="mb-2 text-sm font-medium">Payer reimbursement guidance</h3>
                {payerGuidance?.matched ? (
                  <div className="space-y-1 text-xs">
                    <p>
                      Rule: <span className="font-medium">{payerGuidance.recommendation?.title}</span>
                    </p>
                    {payerGuidance.recommendation?.expectedAmount !== null &&
                    payerGuidance.recommendation?.expectedAmount !== undefined ? (
                      <p>Expected amount: ${payerGuidance.recommendation.expectedAmount.toFixed(2)}</p>
                    ) : null}
                    {payerGuidance.recommendation?.minAmount !== null &&
                    payerGuidance.recommendation?.minAmount !== undefined ? (
                      <p>
                        Expected range: ${payerGuidance.recommendation.minAmount.toFixed(2)} - $
                        {(payerGuidance.recommendation.maxAmount ?? payerGuidance.recommendation.minAmount).toFixed(2)}
                      </p>
                    ) : null}
                    <p>Confidence: {payerGuidance.recommendation?.confidenceLevel ?? "MEDIUM"}</p>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">No matching payer guidance found for this case.</p>
                )}
              </div>

              <UpdateReimbursementStatusForm caseId={selectedCase.id} currentStatus={selectedCase.status} />

              <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <h3 className="mb-3 text-sm font-medium">Create claim record</h3>
                <CreateClaimRecordForm caseId={selectedCase.id} payerName={selectedCase.payerName} />
              </div>

              <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <h3 className="mb-3 text-sm font-medium">Record payment</h3>
                <CreatePaymentRecordForm
                  caseId={selectedCase.id}
                  claims={selectedCase.claims.map((c) => ({
                    id: c.id,
                    claimNumber: c.claimNumber,
                    status: c.status,
                  }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Timeline & Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-medium">Status timeline</h3>
                <div className="space-y-2">
                  {selectedCase.statusEvents.map((e) => (
                    <div key={e.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                      <div className="text-sm font-medium">
                        {e.fromStatus ? `${e.fromStatus} -> ${e.toStatus}` : e.toStatus}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(e.changedAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {selectedCase.statusEvents.length === 0 ? (
                    <p className="text-sm text-zinc-500">No status events yet.</p>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Claims</h3>
                <div className="space-y-2">
                  {selectedCase.claims.map((c) => (
                    <div key={c.id} className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                      <div className="font-medium">{c.claimNumber ?? c.id.slice(0, 10)}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {c.status} · {c.payerName}
                        {c.billedAmount ? ` · $${Number(c.billedAmount).toFixed(2)}` : ""}
                      </div>
                    </div>
                  ))}
                  {selectedCase.claims.length === 0 ? (
                    <p className="text-sm text-zinc-500">No claim records yet.</p>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Payments</h3>
                <div className="space-y-2">
                  {selectedCase.payments.map((p) => (
                    <div key={p.id} className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                      <div className="font-medium">${Number(p.paidAmount).toFixed(2)} · {p.sourceType}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(p.paidDate).toLocaleDateString()}
                        {p.referenceNumber ? ` · ref ${p.referenceNumber}` : ""}
                      </div>
                    </div>
                  ))}
                  {selectedCase.payments.length === 0 ? (
                    <p className="text-sm text-zinc-500">No payment records yet.</p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
