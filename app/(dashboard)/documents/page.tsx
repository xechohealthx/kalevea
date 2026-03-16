import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddDocumentDialog } from "@/components/documents/add-document-dialog";
import { DownloadDocumentButton } from "@/components/documents/download-button";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { documentFilterSchema, listDocuments } from "@/server/services/documents/document.service";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const filter = documentFilterSchema.parse({
    clinicId: typeof searchParams.clinicId === "string" ? searchParams.clinicId : undefined,
    category: typeof searchParams.category === "string" ? searchParams.category : undefined,
  });

  const access = await getAccessSnapshot(session.user.id);
  const clinics = await prisma.clinic.findMany({
    where: { id: { in: access.accessibleClinicIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const documents = await listDocuments({ actorUserId: session.user.id }, filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Secure document storage and tenant-aware access.
          </p>
        </div>
        <AddDocumentDialog clinics={clinics} defaultOrganizationId={access.defaultOrganizationId} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Library</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-4" action="/documents" method="get">
            <select
              name="clinicId"
              defaultValue={filter.clinicId ?? ""}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All accessible clinics</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              name="category"
              defaultValue={filter.category ?? ""}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All categories</option>
              <option value="CONTRACT">Contract</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="TRAINING">Training</option>
              <option value="COMPLIANCE">Compliance</option>
              <option value="SUPPORT">Support</option>
              <option value="GENERAL">General</option>
              <option value="ERA_REMITTANCE">ERA Remittance</option>
            </select>
            <div className="md:col-span-2 flex justify-end">
              <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
                Apply
              </button>
            </div>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {d.title}
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[420px]">
                      {d.storageKey}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                    {d.clinic ? `Clinic: ${d.clinic.name}` : d.organization ? `Org: ${d.organization.name}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{d.category}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{d.mimeType}</TableCell>
                  <TableCell className="text-sm">{d.fileSize.toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DownloadDocumentButton documentId={d.id} />
                  </TableCell>
                </TableRow>
              ))}
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-zinc-500">
                    No documents found.
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

