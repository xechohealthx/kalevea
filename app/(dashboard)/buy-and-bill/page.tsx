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
  getBuyAndBillCase,
  listBuyAndBillCases,
  listMedicationLots,
} from "@/server/services/buy-and-bill/buy-and-bill.service";
import { CreateBuyAndBillCaseDialog } from "@/components/buy-and-bill/create-buy-and-bill-case-dialog";
import { CreateMedicationLotDialog } from "@/components/buy-and-bill/create-medication-lot-dialog";
import { UpdateBuyAndBillStatusForm } from "@/components/buy-and-bill/update-buy-and-bill-status-form";
import { RecordMedicationAdministrationForm } from "@/components/buy-and-bill/record-medication-administration-form";

function statusVariant(status: string): BadgeProps["variant"] {
  if (status === "PAID" || status === "APPROVED") return "success";
  if (status === "DENIED" || status === "CANCELLED") return "danger";
  if (
    status === "READY_FOR_ADMINISTRATION" ||
    status === "ADMINISTERED" ||
    status === "BILLING_PENDING" ||
    status === "SUBMITTED"
  ) {
    return "warning";
  }
  return "outline";
}

export default async function BuyAndBillPage({
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

  const medications = await prisma.medicationCatalogItem.findMany({
    where: {
      isActive: true,
      OR: [
        { organizationId: null },
        ...(access.accessibleOrganizationIds.length > 0
          ? [{ organizationId: { in: access.accessibleOrganizationIds } }]
          : []),
      ],
    },
    select: { id: true, name: true, ndc: true },
    orderBy: { name: "asc" },
  });

  const priorAuthCases = await prisma.priorAuthorizationCase.findMany({
    where: { clinicId: { in: access.accessibleClinicIds } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const cases = await listBuyAndBillCases(
    { actorUserId: session.user.id },
    { clinicId: selectedClinicId, limit: 100 },
  );
  const lots = await listMedicationLots(
    { actorUserId: session.user.id },
    { clinicId: selectedClinicId, includeDepleted: false, limit: 100 },
  );

  const activeCaseId = selectedCaseId ?? cases[0]?.id;
  const selectedCase = activeCaseId ? await getBuyAndBillCase({ actorUserId: session.user.id }, activeCaseId) : null;
  const administrationLotOptions = selectedCase
    ? lots
        .filter((lot) => lot.medicationCatalogItemId === selectedCase.medicationCatalogItemId)
        .map((lot) => ({ id: lot.id, lotNumber: lot.lotNumber, quantityRemaining: lot.quantityRemaining }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Buy & Bill</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Acquisition, administration, and reimbursement case tracking foundation.
          </p>
        </div>
        <div className="flex gap-2">
          <CreateMedicationLotDialog
            clinics={clinics}
            medications={medications}
            selectedClinicId={selectedClinicId}
          />
          <CreateBuyAndBillCaseDialog
            clinics={clinics}
            medications={medications}
            priorAuthCases={priorAuthCases}
            selectedClinicId={selectedClinicId}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Buy-and-bill cases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action="/buy-and-bill" method="get" className="flex justify-end">
            <select
              name="clinicId"
              defaultValue={selectedClinicId ?? ""}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
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
                <TableHead>Medication</TableHead>
                <TableHead>Expected payer</TableHead>
                <TableHead>PA Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link className="hover:underline" href={`/buy-and-bill?caseId=${c.id}`}>
                      {c.id.slice(0, 10)}...
                    </Link>
                  </TableCell>
                  <TableCell>{c.clinic.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>{c.medicationCatalogItem.name}</TableCell>
                  <TableCell>{c.expectedPayerName ?? "—"}</TableCell>
                  <TableCell>{c.priorAuthorizationCase ? c.priorAuthorizationCase.id.slice(0, 10) : "—"}</TableCell>
                </TableRow>
              ))}
              {cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-zinc-500">
                    No buy-and-bill cases found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Medication lots</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot</TableHead>
                <TableHead>Clinic</TableHead>
                <TableHead>Medication</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead>Supplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((lot) => (
                <TableRow key={lot.id}>
                  <TableCell className="font-medium">{lot.lotNumber}</TableCell>
                  <TableCell>{lot.clinic.name}</TableCell>
                  <TableCell>{lot.medicationCatalogItem.name}</TableCell>
                  <TableCell>
                    {lot.quantityRemaining}/{lot.quantityReceived}
                  </TableCell>
                  <TableCell>{new Date(lot.expirationDate).toLocaleDateString()}</TableCell>
                  <TableCell>{lot.supplierName ?? "—"}</TableCell>
                </TableRow>
              ))}
              {lots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-zinc-500">
                    No medication lots found.
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
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-zinc-500">Case ID:</span> {selectedCase.id}
              </div>
              <div>
                <span className="text-zinc-500">Patient reference:</span> {selectedCase.patientReferenceId ?? "—"}
              </div>
              <div>
                <span className="text-zinc-500">Status:</span>{" "}
                <Badge variant={statusVariant(selectedCase.status)}>{selectedCase.status}</Badge>
              </div>
              <div>
                <span className="text-zinc-500">Expected payer:</span> {selectedCase.expectedPayerName ?? "—"}
              </div>
              <div>
                <span className="text-zinc-500">Expected reimbursement:</span>{" "}
                {selectedCase.expectedReimbursementAmount?.toString() ?? "—"}
              </div>
              <UpdateBuyAndBillStatusForm caseId={selectedCase.id} currentStatus={selectedCase.status} />
              <RecordMedicationAdministrationForm caseId={selectedCase.id} lots={administrationLotOptions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Status timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedCase.statusEvents.map((e) => (
                <div key={e.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {e.fromStatus ? `${e.fromStatus} -> ${e.toStatus}` : e.toStatus}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(e.changedAt).toLocaleString()}
                    </div>
                  </div>
                  {e.note ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{e.note}</p> : null}
                </div>
              ))}
              {selectedCase.statusEvents.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">No status events yet.</p>
              ) : null}

              <div className="pt-2">
                <h3 className="mb-2 text-sm font-medium">Administrations</h3>
                <div className="space-y-2">
                  {selectedCase.administrations.map((a) => (
                    <div key={a.id} className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                      <div className="font-medium">
                        {a.unitsAdministered} units · lot {a.medicationLot.lotNumber}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(a.administeredAt).toLocaleString()} by {a.administeredBy.firstName}{" "}
                        {a.administeredBy.lastName}
                      </div>
                    </div>
                  ))}
                  {selectedCase.administrations.length === 0 ? (
                    <p className="text-sm text-zinc-500">No administrations recorded.</p>
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
