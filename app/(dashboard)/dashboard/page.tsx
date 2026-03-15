import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";

function MetricCard(props: {
  title: string;
  value: number | string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {props.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{props.value}</div>
        {props.subtitle ? (
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {props.subtitle}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await getAccessSnapshot(session.user.id);
  const clinicIds = access.accessibleClinicIds;

  const dueCutoff = new Date();
  dueCutoff.setDate(dueCutoff.getDate() + 7);

  const [totalClinics, onboardingClinics, activeClinics, openTickets, tasksDue, trainingCompletions] =
    await Promise.all([
      prisma.clinic.count({ where: { id: { in: clinicIds } } }),
      prisma.clinic.count({ where: { id: { in: clinicIds }, status: "ONBOARDING" } }),
      prisma.clinic.count({ where: { id: { in: clinicIds }, status: "ACTIVE" } }),
      prisma.supportTicket.count({
        where: {
          clinicId: { in: clinicIds },
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        },
      }),
      prisma.onboardingTask.count({
        where: {
          project: { clinicId: { in: clinicIds } },
          status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
          dueDate: { lte: dueCutoff },
        },
      }),
      prisma.trainingAssignment.count({
        where: { clinicId: { in: clinicIds }, status: "COMPLETE" },
      }),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            MSO-level operational visibility across your accessible clinics.
          </p>
        </div>
        <Badge variant="secondary">Core foundation</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard title="Total clinics" value={totalClinics} />
        <MetricCard title="Clinics onboarding" value={onboardingClinics} />
        <MetricCard title="Active clinics" value={activeClinics} />
        <MetricCard title="Open support tickets" value={openTickets} />
        <MetricCard title="Onboarding tasks due (7d)" value={tasksDue} />
        <MetricCard title="Training completions" value={trainingCompletions} />
      </div>
    </div>
  );
}

