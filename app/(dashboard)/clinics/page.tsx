import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddClinicDialog } from "@/components/clinics/add-clinic-dialog";
import { clinicFilterSchema, listClinics } from "@/server/services/clinics/clinic.service";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";

function StatusBadge({ status }: { status: string }) {
  const variant: BadgeProps["variant"] =
    status === "ACTIVE"
      ? "success"
      : status === "ONBOARDING"
        ? "warning"
        : status === "PAUSED"
          ? "danger"
          : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

export default async function ClinicsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const filter = clinicFilterSchema.parse({
    status: typeof searchParams.status === "string" ? searchParams.status : undefined,
    clinicType: typeof searchParams.clinicType === "string" ? searchParams.clinicType : undefined,
    q: typeof searchParams.q === "string" ? searchParams.q : undefined,
  });

  const access = await getAccessSnapshot(session.user.id);
  const clinics = await listClinics({ actorUserId: session.user.id }, filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clinics</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Manage clinic workspaces and onboarding status.
          </p>
        </div>
        {access.defaultOrganizationId ? (
          <AddClinicDialog organizationId={access.defaultOrganizationId} />
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Clinic directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-4" action="/clinics" method="get">
            <input
              name="q"
              defaultValue={filter.q ?? ""}
              placeholder="Search clinics…"
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
            <select
              name="status"
              defaultValue={filter.status ?? ""}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All statuses</option>
              <option value="PROSPECT">Prospect</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
            </select>
            <select
              name="clinicType"
              defaultValue={filter.clinicType ?? ""}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All types</option>
              <option value="PRIMARY_CARE">Primary Care</option>
              <option value="PSYCHIATRY">Psychiatry</option>
              <option value="HOSPITAL_OUTPATIENT">Hospital Outpatient</option>
              <option value="SPECIALTY">Specialty</option>
            </select>
            <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
              Apply
            </button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Org</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clinics.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link className="hover:underline" href={`/clinics/${c.id}`}>
                      {c.name}
                    </Link>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{c.slug}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>{c.clinicType}</TableCell>
                  <TableCell>
                    {c.city ? `${c.city}, ${c.state ?? ""}`.trim() : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                    {c.organization.name}
                  </TableCell>
                </TableRow>
              ))}
              {clinics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-zinc-500">
                    No clinics match your filters.
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

