import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddProviderDialog } from "@/components/providers/add-provider-dialog";
import { AddStaffDialog } from "@/components/providers/add-staff-dialog";
import { listProviders, listStaffProfiles } from "@/server/services/providers/provider.service";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const clinicId = typeof searchParams.clinicId === "string" ? searchParams.clinicId : undefined;
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;

  const access = await getAccessSnapshot(session.user.id);
  const clinics = await prisma.clinic.findMany({
    where: { id: { in: access.accessibleClinicIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [providers, staff] = await Promise.all([
    listProviders({ actorUserId: session.user.id }, { clinicId, q }),
    listStaffProfiles({ actorUserId: session.user.id }, { clinicId, q }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Providers & staff</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Clinic-scoped profiles for providers and staff (not an EMR).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddProviderDialog clinics={clinics} />
          <AddStaffDialog clinics={clinics} />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-4" action="/providers" method="get">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search name, NPI, email…"
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
            <select
              name="clinicId"
              defaultValue={clinicId ?? ""}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All clinics</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="md:col-span-2 flex justify-end">
              <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
                Apply
              </button>
            </div>
          </form>

          <Tabs defaultValue="providers">
            <TabsList>
              <TabsTrigger value="providers">
                Providers <Badge variant="outline" className="ml-2">{providers.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="staff">
                Staff <Badge variant="outline" className="ml-2">{staff.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="providers">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>NPI</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.firstName} {p.lastName}{" "}
                        {p.credentials ? (
                          <span className="text-xs text-zinc-500">({p.credentials})</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                        {p.clinic.name}
                      </TableCell>
                      <TableCell>{p.npi ?? "—"}</TableCell>
                      <TableCell>{p.specialty ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "ACTIVE" ? "success" : "secondary"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {providers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-zinc-500">
                        No providers found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="staff">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.firstName} {s.lastName}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                        {s.clinic.name}
                      </TableCell>
                      <TableCell>{s.title ?? "—"}</TableCell>
                      <TableCell>{s.email ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "ACTIVE" ? "success" : "secondary"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {staff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-zinc-500">
                        No staff profiles found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

