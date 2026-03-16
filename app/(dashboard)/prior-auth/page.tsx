import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreatePACaseDialog } from "@/components/prior-auth/create-pa-case-dialog";
import { UpdatePAStatusForm } from "@/components/prior-auth/update-pa-status-form";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { getPACase, listPACases } from "@/server/services/prior-auth/prior-auth.service";
import { getMatchingPayerRules } from "@/server/services/payer-rules/payer-rule.service";

function statusVariant(status: string): BadgeProps["variant"] {
  if (status === "APPROVED") return "success";
  if (status === "DENIED" || status === "CANCELLED") return "danger";
  if (status === "SUBMITTED" || status === "PENDING_PAYER") return "warning";
  return "outline";
}

export default async function PriorAuthPage({
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

  const cases = await listPACases(
    { actorUserId: session.user.id },
    { clinicId: selectedClinicId, limit: 100 },
  );
  const activeCaseId = selectedCaseId ?? cases[0]?.id;
  const selectedCase = activeCaseId
    ? await getPACase({ actorUserId: session.user.id }, activeCaseId)
    : null;
  const payerGuidanceRules = selectedCase
    ? await getMatchingPayerRules(
        { actorUserId: session.user.id },
        {
          organizationId: selectedCase.organizationId,
          clinicId: selectedCase.clinicId,
          payerName: selectedCase.payerName,
          serviceContext: "prior_auth",
          limit: 5,
        },
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prior Authorization</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Operational PA case tracking with status lifecycle and attachments.
          </p>
        </div>
        <CreatePACaseDialog clinics={clinics} selectedClinicId={selectedClinicId} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">PA cases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action="/prior-auth" method="get" className="flex justify-end">
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
                <TableHead>Medication</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link className="hover:underline" href={`/prior-auth?caseId=${c.id}`}>
                      {c.id.slice(0, 10)}...
                    </Link>
                  </TableCell>
                  <TableCell>{c.clinic.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>{c.payerName}</TableCell>
                  <TableCell>{c.medicationName}</TableCell>
                  <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                    {new Date(c.updatedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-zinc-500">
                    No prior authorization cases found.
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
                <span className="text-zinc-500">Payer:</span> {selectedCase.payerName}
              </div>
              <div>
                <span className="text-zinc-500">Medication:</span> {selectedCase.medicationName}
              </div>
              <div>
                <span className="text-zinc-500">Patient ref:</span>{" "}
                {selectedCase.patientReferenceId ?? "—"}
              </div>
              <div>
                <span className="text-zinc-500">Current status:</span>{" "}
                <Badge variant={statusVariant(selectedCase.status)}>{selectedCase.status}</Badge>
              </div>
              <div>
                <span className="text-zinc-500">Attachments:</span> {selectedCase.attachments.length}
              </div>
              <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <h3 className="mb-2 text-sm font-medium">Payer guidance (read-only)</h3>
                <div className="space-y-2">
                  {payerGuidanceRules.map((rule) => (
                    <div key={rule.id} className="rounded-md border border-zinc-200 p-2 text-xs dark:border-zinc-800">
                      <div className="font-medium">
                        {rule.ruleCategory} · {rule.title}
                      </div>
                      {rule.description ? (
                        <p className="mt-1 text-zinc-600 dark:text-zinc-300">{rule.description}</p>
                      ) : null}
                    </div>
                  ))}
                  {payerGuidanceRules.length === 0 ? (
                    <p className="text-xs text-zinc-500">No payer guidance rules matched this case.</p>
                  ) : null}
                </div>
              </div>
              <UpdatePAStatusForm caseId={selectedCase.id} currentStatus={selectedCase.status} />
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
                      {new Date(e.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {e.note ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{e.note}</p> : null}
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    By: {e.changedBy ? `${e.changedBy.firstName} ${e.changedBy.lastName}` : "System"}
                  </p>
                </div>
              ))}
              {selectedCase.statusEvents.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">No status events yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
