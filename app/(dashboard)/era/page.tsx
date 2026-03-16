import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { listEraFiles } from "@/server/services/era/era.service";
import { EraUploadForm } from "@/components/era/era-upload-form";

function formatAmount(value: unknown): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

export default async function EraPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await getAccessSnapshot(session.user.id);
  const clinics = await prisma.clinic.findMany({
    where: { id: { in: access.accessibleClinicIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const files = await listEraFiles({ actorUserId: session.user.id }, { limit: 50 });
  const totalFiles = files.length;
  const matchedFiles = files.filter((f) => f.reconciliationStatus === "MATCHED").length;
  const unmatchedPayments = files.reduce(
    (acc, f) => acc + f.payments.filter((p) => p.reconciliationStatus === "UNMATCHED").length,
    0,
  );
  const totalAmount = files.reduce((acc, f) => acc + Number(f.totalAmount?.toString() ?? "0"), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ERA / 835 Ingestion</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Upload remittance files, parse claim payments, and reconcile into reimbursement records.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Files ingested</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{totalFiles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Matched files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{matchedFiles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Unmatched payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{unmatchedPayments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Remittance total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{formatAmount(totalAmount)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Upload ERA file</CardTitle>
        </CardHeader>
        <CardContent>
          <EraUploadForm clinics={clinics} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent remittance files</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Clinic</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Reconciliation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>{new Date(file.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{file.clinic.name}</TableCell>
                  <TableCell>{file.payerName ?? "-"}</TableCell>
                  <TableCell>{formatAmount(file.totalAmount?.toString())}</TableCell>
                  <TableCell>{file.payments.length}</TableCell>
                  <TableCell>
                    <Badge variant={file.reconciliationStatus === "MATCHED" ? "success" : "warning"}>
                      {file.reconciliationStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-zinc-500">
                    No remittance files ingested yet.
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
