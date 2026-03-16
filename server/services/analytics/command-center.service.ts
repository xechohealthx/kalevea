import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";
import type { ServiceContext } from "@/server/services/service-context";

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) return 0;
  return Number(value.toString());
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function daysBetween(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

async function resolveCommandCenterScope(ctx: ServiceContext, organizationId?: string) {
  const access = await getAccessSnapshot(ctx.actorUserId);
  const orgId = organizationId ?? access.defaultOrganizationId ?? undefined;
  if (!orgId) throw new AppError("No organization access", "UNAUTHORIZED", 403);

  await requirePermission(ctx.actorUserId, Permissions.commandCenter.read, {
    scope: "ORGANIZATION",
    organizationId: orgId,
  });

  const clinics = await prisma.clinic.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });

  const hasGlobal = access.globalRoleKeys.length > 0;
  const clinicIds = hasGlobal
    ? clinics.map((c) => c.id)
    : clinics.filter((c) => access.accessibleClinicIds.includes(c.id)).map((c) => c.id);

  if (clinicIds.length === 0) throw new AppError("No clinic access in organization", "UNAUTHORIZED", 403);
  return { organizationId: orgId, clinicIds, clinics: clinics.filter((c) => clinicIds.includes(c.id)) };
}

async function loadSharedData(ctx: ServiceContext, organizationId?: string) {
  const scope = await resolveCommandCenterScope(ctx, organizationId);
  const clinicIds = scope.clinicIds;

  const [paCases, buyAndBillCases, reimbursementCases, payments, supportTickets, onboardingProjects, onboardingTasks, trainingAssignments] =
    await Promise.all([
      prisma.priorAuthorizationCase.findMany({
        where: { organizationId: scope.organizationId, clinicId: { in: clinicIds } },
        select: { id: true, clinicId: true, payerName: true, status: true, updatedAt: true },
      }),
      prisma.buyAndBillCase.findMany({
        where: { organizationId: scope.organizationId, clinicId: { in: clinicIds } },
        select: { id: true, clinicId: true, status: true, createdAt: true },
      }),
      prisma.reimbursementCase.findMany({
        where: { organizationId: scope.organizationId, clinicId: { in: clinicIds } },
        select: {
          id: true,
          clinicId: true,
          payerName: true,
          expectedAmount: true,
          underpaymentFlag: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.paymentRecord.findMany({
        where: { organizationId: scope.organizationId, clinicId: { in: clinicIds } },
        select: { reimbursementCaseId: true, clinicId: true, paidAmount: true, paidDate: true },
      }),
      prisma.supportTicket.findMany({
        where: { clinicId: { in: clinicIds } },
        select: { id: true, clinicId: true, status: true, priority: true, updatedAt: true, createdAt: true },
      }),
      prisma.clinicOnboardingProject.findMany({
        where: { clinicId: { in: clinicIds } },
        select: { id: true, clinicId: true, status: true, updatedAt: true },
      }),
      prisma.onboardingTask.findMany({
        where: { project: { clinicId: { in: clinicIds } } },
        select: { id: true, projectId: true, status: true, dueDate: true },
      }),
      prisma.trainingAssignment.findMany({
        where: { clinicId: { in: clinicIds } },
        select: { id: true, clinicId: true, status: true, assignedAt: true, completedAt: true },
      }),
    ]);

  return {
    ...scope,
    paCases,
    buyAndBillCases,
    reimbursementCases,
    payments,
    supportTickets,
    onboardingProjects,
    onboardingTasks,
    trainingAssignments,
  };
}

export async function getExecutiveSummary(ctx: ServiceContext, input?: { organizationId?: string }) {
  const data = await loadSharedData(ctx, input?.organizationId);
  const activeClinics = data.clinics.filter((c) => c.status === "ACTIVE").length;
  const pendingOnboardingClinics = data.clinics.filter((c) => c.status === "ONBOARDING" || c.status === "PROSPECT").length;

  const paOpen = data.paCases.filter((c) => ["DRAFT", "SUBMITTED", "PENDING_PAYER"].includes(c.status)).length;
  const paApproved = data.paCases.filter((c) => c.status === "APPROVED").length;
  const paDenied = data.paCases.filter((c) => c.status === "DENIED").length;
  const paApprovalRate = paApproved + paDenied > 0 ? (paApproved / (paApproved + paDenied)) * 100 : 0;

  const bnbByStage = data.buyAndBillCases.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const paymentByCase = new Map<string, number>();
  for (const payment of data.payments) {
    paymentByCase.set(
      payment.reimbursementCaseId,
      (paymentByCase.get(payment.reimbursementCaseId) ?? 0) + decimalToNumber(payment.paidAmount),
    );
  }

  const totalExpected = data.reimbursementCases.reduce((sum, c) => sum + decimalToNumber(c.expectedAmount), 0);
  const totalPaid = data.reimbursementCases.reduce((sum, c) => sum + (paymentByCase.get(c.id) ?? 0), 0);
  const totalOpenVariance = totalPaid - totalExpected;
  const underpaidCaseCount = data.reimbursementCases.filter((c) => c.underpaymentFlag).length;

  logger.info("Command center executive summary queried", {
    actorUserId: ctx.actorUserId,
    organizationId: data.organizationId,
  });

  return {
    organizationId: data.organizationId,
    activeClinics,
    pendingOnboardingClinics,
    openPACases: paOpen,
    paApprovalRate,
    buyAndBillByStage: bnbByStage,
    totalExpectedReimbursement: totalExpected,
    totalPaidReimbursement: totalPaid,
    totalOpenVariance,
    underpaidCaseCount,
  };
}

export async function getPAOpsSummary(ctx: ServiceContext, input?: { organizationId?: string }) {
  const data = await loadSharedData(ctx, input?.organizationId);
  const byStatus = data.paCases.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const approved = byStatus.APPROVED ?? 0;
  const denied = byStatus.DENIED ?? 0;
  const pendingBacklog =
    (byStatus.DRAFT ?? 0) + (byStatus.SUBMITTED ?? 0) + (byStatus.PENDING_PAYER ?? 0);
  const requiringAction = pendingBacklog + denied;
  const approvalRate = approved + denied > 0 ? (approved / (approved + denied)) * 100 : 0;

  const payerMap = new Map<string, number>();
  for (const row of data.paCases) {
    payerMap.set(row.payerName, (payerMap.get(row.payerName) ?? 0) + 1);
  }
  const payerConcentration = Array.from(payerMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([payerName, volume]) => ({ payerName, volume }));

  logger.info("Command center PA ops summary queried", {
    actorUserId: ctx.actorUserId,
    organizationId: data.organizationId,
  });

  return {
    organizationId: data.organizationId,
    totalCases: data.paCases.length,
    byStatus,
    approvalRate,
    deniedCount: denied,
    pendingBacklog,
    requiringAction,
    payerConcentration,
  };
}

export async function getRevenueOpsSummary(ctx: ServiceContext, input?: { organizationId?: string }) {
  const data = await loadSharedData(ctx, input?.organizationId);

  const buyAndBillByStage = data.buyAndBillCases.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  const reimbursementByStatus = data.reimbursementCases.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const paidByCase = new Map<string, number>();
  for (const payment of data.payments) {
    paidByCase.set(payment.reimbursementCaseId, (paidByCase.get(payment.reimbursementCaseId) ?? 0) + decimalToNumber(payment.paidAmount));
  }

  let totalExpected = 0;
  let totalPaid = 0;
  const payerVariance = new Map<string, number>();
  const clinicVariance = new Map<string, number>();

  for (const row of data.reimbursementCases) {
    const expected = decimalToNumber(row.expectedAmount);
    const paid = paidByCase.get(row.id) ?? 0;
    const variance = paid - expected;
    totalExpected += expected;
    totalPaid += paid;
    payerVariance.set(row.payerName, (payerVariance.get(row.payerName) ?? 0) + variance);
    clinicVariance.set(row.clinicId, (clinicVariance.get(row.clinicId) ?? 0) + variance);
  }

  const topPayersByVariance = Array.from(payerVariance.entries())
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10)
    .map(([payerName, variance]) => ({ payerName, variance }));
  const clinicNameById = new Map(data.clinics.map((c) => [c.id, c.name]));
  const topClinicsByVariance = Array.from(clinicVariance.entries())
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10)
    .map(([clinicId, variance]) => ({ clinicId, clinicName: clinicNameById.get(clinicId) ?? clinicId, variance }));

  const underpaymentCount = data.reimbursementCases.filter((r) => r.underpaymentFlag).length;

  logger.info("Command center revenue ops summary queried", {
    actorUserId: ctx.actorUserId,
    organizationId: data.organizationId,
  });

  return {
    organizationId: data.organizationId,
    buyAndBillByStage,
    reimbursementByStatus,
    totalExpected,
    totalPaid,
    totalOpenVariance: totalPaid - totalExpected,
    underpaymentCount,
    topPayersByVariance,
    topClinicsByVariance,
  };
}

export async function getClinicHealthSummary(ctx: ServiceContext, input?: { organizationId?: string }) {
  const data = await loadSharedData(ctx, input?.organizationId);
  const paidByCase = new Map<string, number>();
  const firstPaymentByCase = new Map<string, Date>();
  for (const p of data.payments) {
    paidByCase.set(p.reimbursementCaseId, (paidByCase.get(p.reimbursementCaseId) ?? 0) + decimalToNumber(p.paidAmount));
    const existing = firstPaymentByCase.get(p.reimbursementCaseId);
    if (!existing || p.paidDate < existing) firstPaymentByCase.set(p.reimbursementCaseId, p.paidDate);
  }

  const now = Date.now();
  const rows = data.clinics.map((clinic) => {
    const clinicPA = data.paCases.filter((c) => c.clinicId === clinic.id);
    const approved = clinicPA.filter((c) => c.status === "APPROVED").length;
    const denied = clinicPA.filter((c) => c.status === "DENIED").length;
    const clinicReimb = data.reimbursementCases.filter((c) => c.clinicId === clinic.id);
    const expected = clinicReimb.reduce((sum, c) => sum + decimalToNumber(c.expectedAmount), 0);
    const paid = clinicReimb.reduce((sum, c) => sum + (paidByCase.get(c.id) ?? 0), 0);
    const underpaidCount = clinicReimb.filter((c) => c.underpaymentFlag).length;
    const paymentLags = clinicReimb
      .map((c) => {
        const first = firstPaymentByCase.get(c.id);
        if (!first) return null;
        return daysBetween(c.createdAt, first);
      })
      .filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0);
    const clinicSupport = data.supportTickets.filter((t) => t.clinicId === clinic.id);
    const openSupport = clinicSupport.filter((t) => ["OPEN", "IN_PROGRESS", "WAITING"].includes(t.status)).length;
    const staleSupport = clinicSupport.filter((t) => ["OPEN", "IN_PROGRESS", "WAITING"].includes(t.status) && now - t.updatedAt.getTime() > 14 * 24 * 60 * 60 * 1000).length;

    const project = data.onboardingProjects.find((p) => p.clinicId === clinic.id);
    const projectTasks = data.onboardingTasks.filter((t) => t.projectId === project?.id);
    const doneTasks = projectTasks.filter((t) => t.status === "DONE").length;
    const onboardingProgressPct = projectTasks.length > 0 ? (doneTasks / projectTasks.length) * 100 : project ? 0 : 100;

    const training = data.trainingAssignments.filter((a) => a.clinicId === clinic.id);
    const trainingCompleted = training.filter((a) => a.status === "COMPLETE").length;
    const trainingCompletionRate = training.length > 0 ? (trainingCompleted / training.length) * 100 : 0;

    const paApprovalRate = approved + denied > 0 ? (approved / (approved + denied)) * 100 : 0;
    const underpaymentRate = clinicReimb.length > 0 ? (underpaidCount / clinicReimb.length) * 100 : 0;
    const avgDaysToPayment = average(paymentLags);

    const riskScore =
      (underpaymentRate > 40 ? 35 : underpaymentRate > 25 ? 20 : 8) +
      (avgDaysToPayment > 45 ? 25 : avgDaysToPayment > 30 ? 14 : 6) +
      (paApprovalRate < 50 ? 20 : paApprovalRate < 65 ? 10 : 4) +
      (openSupport > 12 ? 12 : openSupport > 6 ? 7 : 3) +
      (onboardingProgressPct < 60 ? 8 : onboardingProgressPct < 85 ? 4 : 1);

    const healthBand = riskScore >= 70 ? "AT_RISK" : riskScore >= 45 ? "WATCH" : "HEALTHY";

    return {
      clinicId: clinic.id,
      clinicName: clinic.name,
      clinicStatus: clinic.status,
      healthBand,
      riskScore,
      onboardingProgressPct,
      paApprovalRate,
      reimbursementExpected: expected,
      reimbursementPaid: paid,
      reimbursementVariance: paid - expected,
      underpaymentRate,
      avgDaysToPayment,
      openSupport,
      staleSupport,
      trainingCompletionRate,
    };
  });

  logger.info("Command center clinic health queried", {
    actorUserId: ctx.actorUserId,
    organizationId: data.organizationId,
    clinicCount: rows.length,
  });
  return rows.sort((a, b) => b.riskScore - a.riskScore);
}

export async function getSupportOpsSummary(ctx: ServiceContext, input?: { organizationId?: string }) {
  const data = await loadSharedData(ctx, input?.organizationId);
  const now = Date.now();
  const open = data.supportTickets.filter((t) => ["OPEN", "IN_PROGRESS", "WAITING"].includes(t.status));
  const stale = open.filter((t) => now - t.updatedAt.getTime() > 14 * 24 * 60 * 60 * 1000);
  const urgent = open.filter((t) => t.priority === "URGENT" || t.priority === "HIGH");

  const trainingTotal = data.trainingAssignments.length;
  const trainingComplete = data.trainingAssignments.filter((t) => t.status === "COMPLETE").length;

  const openByClinic = new Map<string, number>();
  for (const row of open) openByClinic.set(row.clinicId, (openByClinic.get(row.clinicId) ?? 0) + 1);
  const clinicNameById = new Map(data.clinics.map((c) => [c.id, c.name]));

  logger.info("Command center support ops queried", {
    actorUserId: ctx.actorUserId,
    organizationId: data.organizationId,
  });

  return {
    organizationId: data.organizationId,
    openTicketCount: open.length,
    staleTicketCount: stale.length,
    urgentTicketCount: urgent.length,
    trainingCompletionRate: trainingTotal > 0 ? (trainingComplete / trainingTotal) * 100 : 0,
    openTicketsByClinic: Array.from(openByClinic.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([clinicId, count]) => ({ clinicId, clinicName: clinicNameById.get(clinicId) ?? clinicId, count })),
  };
}

export async function getOperationalAlerts(ctx: ServiceContext, input?: { organizationId?: string }) {
  const [executive, paOps, clinicHealth, support] = await Promise.all([
    getExecutiveSummary(ctx, input),
    getPAOpsSummary(ctx, input),
    getClinicHealthSummary(ctx, input),
    getSupportOpsSummary(ctx, input),
  ]);

  const alerts: Array<{
    id: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    title: string;
    description: string;
    metric?: string;
  }> = [];

  if (executive.underpaidCaseCount >= 10) {
    alerts.push({
      id: "underpayment-high",
      severity: "HIGH",
      title: "High underpayment volume",
      description: `${executive.underpaidCaseCount} reimbursement cases are flagged underpaid.`,
      metric: `${executive.underpaidCaseCount} cases`,
    });
  }
  if (Math.abs(executive.totalOpenVariance) > 25_000) {
    alerts.push({
      id: "variance-threshold",
      severity: "HIGH",
      title: "Open reimbursement variance exceeds threshold",
      description: `Network open variance is ${executive.totalOpenVariance.toFixed(2)}.`,
      metric: `$${executive.totalOpenVariance.toFixed(2)}`,
    });
  }
  if (paOps.pendingBacklog >= 15 || paOps.deniedCount >= 8) {
    alerts.push({
      id: "pa-backlog",
      severity: "MEDIUM",
      title: "PA backlog requires attention",
      description: `${paOps.pendingBacklog} PA cases are pending and ${paOps.deniedCount} denied.`,
      metric: `${paOps.pendingBacklog} pending`,
    });
  }
  const slowPaymentClinics = clinicHealth.filter((c) => c.avgDaysToPayment > 40);
  if (slowPaymentClinics.length > 0) {
    alerts.push({
      id: "slow-payments",
      severity: "MEDIUM",
      title: "Slow payment timelines detected",
      description: `${slowPaymentClinics.length} clinics are above 40 days average to payment.`,
      metric: `${slowPaymentClinics.length} clinics`,
    });
  }
  if (support.staleTicketCount >= 10) {
    alerts.push({
      id: "stale-support",
      severity: "LOW",
      title: "Support backlog is aging",
      description: `${support.staleTicketCount} open support tickets are stale (>14 days).`,
      metric: `${support.staleTicketCount} stale`,
    });
  }
  const atRisk = clinicHealth.filter((c) => c.healthBand === "AT_RISK").length;
  if (atRisk > 0) {
    alerts.push({
      id: "clinic-risk",
      severity: "HIGH",
      title: "Clinic risk flags present",
      description: `${atRisk} clinics are currently classified as at risk.`,
      metric: `${atRisk} clinics`,
    });
  }

  logger.info("Command center operational alerts generated", {
    actorUserId: ctx.actorUserId,
    organizationId: executive.organizationId,
    alertCount: alerts.length,
  });

  return alerts;
}
