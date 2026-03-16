import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceHeader } from "@/components/system/layout/workspace-header";
import { MetricCard } from "@/components/system/data-display/metric-card";
import { StatusBadge } from "@/components/system/data-display/status-badge";
import { EntityTable, type EntityTableColumn } from "@/components/system/data-display/entity-table";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await getAccessSnapshot(session.user.id);
  const clinicIds = access.accessibleClinicIds;

  const dueCutoff = new Date();
  dueCutoff.setDate(dueCutoff.getDate() + 7);

  const [totalClinics, onboardingClinics, activeClinics, openTickets, tasksDue, trainingCompletions, clinics, ticketCounts] =
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
      prisma.clinic.findMany({
        where: { id: { in: clinicIds } },
        select: { id: true, name: true, clinicType: true, status: true },
        orderBy: [{ name: "asc" }],
        take: 10,
      }),
      prisma.supportTicket.groupBy({
        by: ["clinicId"],
        where: {
          clinicId: { in: clinicIds },
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        },
        _count: { _all: true },
      }),
    ]);

  const ticketCountByClinic = new Map(ticketCounts.map((row) => [row.clinicId, row._count._all]));
  const clinicRows = clinics.map((clinic) => ({
    ...clinic,
    openTicketCount: ticketCountByClinic.get(clinic.id) ?? 0,
  }));

  const clinicColumns: Array<EntityTableColumn<(typeof clinicRows)[number]>> = [
    {
      id: "name",
      header: "Clinic",
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: "type",
      header: "Type",
      cell: (row) => row.clinicType,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge label={row.status} tone="info" />,
    },
    {
      id: "openTickets",
      header: "Open tickets",
      cell: (row) => row.openTicketCount,
      cellClassName: "tabular-nums",
    },
  ];

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Dashboard"
        description="MSO-level operational visibility across your accessible clinics."
        scopeLabel="Network"
        actions={<StatusBadge label="Core foundation" tone="neutral" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Total clinics" value={totalClinics} />
        <MetricCard label="Clinics onboarding" value={onboardingClinics} />
        <MetricCard label="Active clinics" value={activeClinics} />
        <MetricCard label="Open support tickets" value={openTickets} trendLabel={openTickets > 0 ? "Needs attention" : "Stable"} trendTone={openTickets > 0 ? "warning" : "success"} />
        <MetricCard label="Onboarding tasks due (7d)" value={tasksDue} trendLabel={tasksDue > 0 ? "Upcoming due" : "Clear"} trendTone={tasksDue > 0 ? "warning" : "success"} />
        <MetricCard label="Training completions" value={trainingCompletions} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Clinic operations snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <EntityTable
            columns={clinicColumns}
            rows={clinicRows}
            getRowKey={(row) => row.id}
            emptyState="No accessible clinics found for your current scope."
          />
        </CardContent>
      </Card>
    </div>
  );
}

