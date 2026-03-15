import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOnboardingProject } from "@/server/services/onboarding/onboarding.service";
import { OnboardingTaskCard } from "@/components/onboarding/task-card";

const columns: Array<{
  key: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  label: string;
}> = [
  { key: "TODO", label: "To do" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "BLOCKED", label: "Blocked" },
  { key: "DONE", label: "Done" },
];

export default async function OnboardingProjectPage({
  params,
}: {
  params: { projectId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const project = await getOnboardingProject(
    { actorUserId: session.user.id },
    params.projectId,
  );

  const grouped = columns.reduce((acc, c) => {
    acc[c.key] = project.tasks.filter((t) => t.status === c.key);
    return acc;
  }, {} as Record<string, typeof project.tasks>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.clinic.name} onboarding
            </h1>
            <Badge variant="secondary">{project.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Task board for onboarding execution and blockers.
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Clinic workspace:{" "}
            <Link className="underline" href={`/clinics/${project.clinic.id}`}>
              {project.clinic.name}
            </Link>
          </p>
        </div>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Owner:{" "}
          <span className="font-medium text-zinc-950 dark:text-zinc-50">
            {project.owner ? `${project.owner.firstName} ${project.owner.lastName}` : "—"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {columns.map((col) => (
          <Card key={col.key} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{col.label}</CardTitle>
                <Badge variant="outline">{grouped[col.key].length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {grouped[col.key].map((t) => (
                <OnboardingTaskCard
                  key={t.id}
                  task={{
                    id: t.id,
                    category: t.category,
                    title: t.title,
                    description: t.description,
                    status: t.status,
                    dueDate: t.dueDate,
                  }}
                />
              ))}
              {grouped[col.key].length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  No tasks.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

