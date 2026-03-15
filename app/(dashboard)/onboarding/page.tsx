import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listOnboardingProjects } from "@/server/services/onboarding/onboarding.service";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projects = await listOnboardingProjects({ actorUserId: session.user.id });

  const counts = projects.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Clinic onboarding projects and operational task tracking.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETE"].map((s) => (
          <Card key={s}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-600 dark:text-zinc-400">{s}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold tracking-tight">
              {counts[s] ?? 0}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Tasks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link href={`/onboarding/${p.id}`} className="hover:underline">
                      {p.clinic.name}
                    </Link>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {p.clinic.clinicType}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                    {p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : "—"}
                  </TableCell>
                  <TableCell>{p._count.tasks}</TableCell>
                </TableRow>
              ))}
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-zinc-500">
                    No onboarding projects yet.
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

