import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateTicketDialog } from "@/components/support/create-ticket-dialog";
import { listTickets, ticketFilterSchema } from "@/server/services/support/support.service";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const filter = ticketFilterSchema.parse({
    clinicId: typeof searchParams.clinicId === "string" ? searchParams.clinicId : undefined,
    status: typeof searchParams.status === "string" ? searchParams.status : undefined,
    priority: typeof searchParams.priority === "string" ? searchParams.priority : undefined,
  });

  const access = await getAccessSnapshot(session.user.id);
  const clinics = await prisma.clinic.findMany({
    where: { id: { in: access.accessibleClinicIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const tickets = await listTickets({ actorUserId: session.user.id }, filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Ticketing and operational communication (no PHI).
          </p>
        </div>
        <CreateTicketDialog clinics={clinics} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tickets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-4" action="/support" method="get">
            <select
              name="clinicId"
              defaultValue={filter.clinicId ?? ""}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All clinics</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={filter.status ?? ""}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="WAITING">Waiting</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
            <select
              name="priority"
              defaultValue={filter.priority ?? ""}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
              Apply
            </button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Clinic</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <Link href={`/support/${t.id}`} className="hover:underline">
                      {t.subject}
                    </Link>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t.clinic.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.priority === "URGENT" || t.priority === "HIGH" ? "warning" : "secondary"}>
                      {t.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.status === "OPEN" ? "warning" : t.status === "RESOLVED" ? "success" : "secondary"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{t._count.comments}</TableCell>
                </TableRow>
              ))}
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-zinc-500">
                    No tickets found.
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

