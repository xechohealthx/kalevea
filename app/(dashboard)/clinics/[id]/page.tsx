import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getClinicById } from "@/server/services/clinics/clinic.service";

export default async function ClinicWorkspacePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = params;
  const clinic = await getClinicById({ actorUserId: session.user.id }, id);

  const [providers, staff, openTickets, assignments, documents, onboardingTasks] =
    await Promise.all([
      prisma.provider.count({ where: { clinicId: clinic.id } }),
      prisma.staffProfile.count({ where: { clinicId: clinic.id } }),
      prisma.supportTicket.count({
        where: {
          clinicId: clinic.id,
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        },
      }),
      prisma.trainingAssignment.count({ where: { clinicId: clinic.id } }),
      prisma.document.count({ where: { clinicId: clinic.id } }),
      prisma.onboardingTask.count({ where: { project: { clinicId: clinic.id } } }),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{clinic.name}</h1>
            <Badge variant="secondary">{clinic.clinicType}</Badge>
            <Badge variant="outline">{clinic.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Clinic workspace overview and operational modules.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/onboarding"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            View onboarding
          </Link>
          <Link
            href="/support"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            View support
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="providers">Providers/Staff</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-600 dark:text-zinc-400">
                  Providers
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold tracking-tight">
                {providers}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-600 dark:text-zinc-400">
                  Staff profiles
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold tracking-tight">
                {staff}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-600 dark:text-zinc-400">
                  Open support tickets
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold tracking-tight">
                {openTickets}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-600 dark:text-zinc-400">
                  Training assignments
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold tracking-tight">
                {assignments}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-600 dark:text-zinc-400">
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold tracking-tight">
                {documents}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-600 dark:text-zinc-400">
                  Onboarding tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold tracking-tight">
                {onboardingTasks}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="onboarding">
          <Card>
            <CardHeader>
              <CardTitle>Onboarding status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <div>
                Project:{" "}
                <span className="font-medium text-zinc-950 dark:text-zinc-50">
                  {clinic.onboarding ? clinic.onboarding.status : "Not started"}
                </span>
              </div>
              <div className="text-xs">
                Go to <Link className="underline" href="/onboarding">Onboarding</Link> to manage tasks.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers">
          <Card>
            <CardHeader>
              <CardTitle>Providers & staff</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
              Manage providers and staff in the <Link className="underline" href="/providers">Providers</Link> module.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support">
          <Card>
            <CardHeader>
              <CardTitle>Support</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
              View and create support tickets in <Link className="underline" href="/support">Support</Link>.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training">
          <Card>
            <CardHeader>
              <CardTitle>Training</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
              Courses and assignments are managed in <Link className="underline" href="/training">Training</Link>.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
              Document metadata and uploads live in <Link className="underline" href="/documents">Documents</Link>.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

