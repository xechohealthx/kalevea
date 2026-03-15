import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import { listAssignments, listCourses } from "@/server/services/training/training.service";

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const clinicId = typeof searchParams.clinicId === "string" ? searchParams.clinicId : undefined;
  const access = await getAccessSnapshot(session.user.id);
  const clinics = await prisma.clinic.findMany({
    where: { id: { in: access.accessibleClinicIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [courses, assignments] = await Promise.all([
    listCourses(),
    listAssignments({ actorUserId: session.user.id }, clinicId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Training</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Education scaffolding for advanced therapy operations, compliance, and billing.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Courses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {courses.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div>
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {c.description ?? "—"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.category ? <Badge variant="outline">{c.category}</Badge> : null}
                  <Badge variant="secondary">{c._count.lessons} lessons</Badge>
                </div>
              </div>
            ))}
            {courses.length === 0 ? (
              <p className="text-sm text-zinc-500">No published courses yet.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Assignments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 md:grid-cols-3" action="/training" method="get">
              <select
                name="clinicId"
                defaultValue={clinicId ?? ""}
                className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:col-span-2"
              >
                <option value="">All clinics</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
                Apply
              </button>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                      {a.clinic.name}
                    </TableCell>
                    <TableCell>
                      {a.provider
                        ? `${a.provider.firstName} ${a.provider.lastName} (Provider)`
                        : a.staffProfile
                          ? `${a.staffProfile.firstName} ${a.staffProfile.lastName} (Staff)`
                          : "—"}
                    </TableCell>
                    <TableCell className="font-medium">{a.course.title}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          (a.status === "COMPLETE"
                            ? "success"
                            : a.status === "IN_PROGRESS"
                              ? "warning"
                              : "secondary") as BadgeProps["variant"]
                        }
                      >
                        {a.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-zinc-500">
                      No assignments found.
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

