import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import type { ServiceContext } from "@/server/services/service-context";

import { buildKalContext } from "./kal-context.service";
import { kalAnswerSchema, type KalAnswer, type KalIntent } from "./kal.schemas";
import {
  predictClinicOperationalRisk,
  predictExpectedRevenue,
  predictPaymentTimeline,
} from "@/server/services/analytics/predictive-analytics.service";

type OpenAIChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function sanitizeUserQuery(query: string) {
  return query
    .slice(0, 2000)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]");
}

function fallbackFromContext(input: { query: string; context: Awaited<ReturnType<typeof buildKalContext>> }): KalAnswer {
  const alertsTool = input.context.tools.find((tool) => tool.toolName === "getAutomationAlerts")?.data as
    | Array<{ severity: string; title: string; description: string }>
    | undefined;
  const underpaidTool = input.context.tools.find((tool) => tool.toolName === "listUnderpaidCases")?.data as
    | Array<{ id: string; clinicName: string; payerName: string; varianceAmount: number }>
    | undefined;
  const onboardingTool = input.context.tools.find((tool) => tool.toolName === "getOnboardingProgress")?.data as
    | Array<{ clinicName: string; progressPct: number; blockedTasks: number; blockers: Array<{ title: string }> }>
    | undefined;

  const keyFindings: string[] = [];
  if (alertsTool?.length) keyFindings.push(`${alertsTool.length} operational alerts are active in the current scope.`);
  if (underpaidTool?.length) keyFindings.push(`${underpaidTool.length} underpaid reimbursement cases are currently flagged.`);
  if (onboardingTool?.length) {
    const blocked = onboardingTool.reduce((sum, row) => sum + row.blockedTasks, 0);
    keyFindings.push(`Onboarding has ${blocked} blocked tasks across ${onboardingTool.length} tracked projects.`);
  }
  if (keyFindings.length === 0) keyFindings.push("No high-risk indicators were detected in currently available context tools.");

  const recommendedActions: KalAnswer["recommendedActions"] = [
    {
      title: "Review highest-severity operational alerts",
      reason: "Alerts aggregate cross-domain risk signals and provide the fastest triage path.",
      priority: "HIGH",
      actionType: "reviewOnly",
      targetEntityType: null,
      targetEntityId: null,
      requiresHumanConfirmation: true,
    },
  ];

  if (underpaidTool?.[0]) {
    recommendedActions.push({
      title: "Create reimbursement follow-up task",
      reason: `Investigate underpayment variance for payer ${underpaidTool[0].payerName}.`,
      priority: "HIGH",
      actionType: "createTask",
      targetEntityType: "ReimbursementCase",
      targetEntityId: underpaidTool[0].id,
      requiresHumanConfirmation: true,
    });
  }

  return {
    summary:
      "Kal generated a deterministic response because OpenAI is not configured. Insights are based on current analytics and operations context only.",
    keyFindings,
    recommendedActions,
    followUpQuestions: [
      "Do you want me to focus on PA operations, reimbursement variance, or onboarding blockers?",
      "Should I narrow the analysis to a single clinic?",
    ],
    toolsUsed: input.context.tools.map((tool) => tool.toolName),
  };
}

async function callOpenAIKal(input: {
  query: string;
  context: Awaited<ReturnType<typeof buildKalContext>>;
  model?: string;
}): Promise<KalAnswer> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "kal_answer",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["summary", "keyFindings", "recommendedActions", "followUpQuestions", "toolsUsed"],
            properties: {
              summary: { type: "string" },
              keyFindings: { type: "array", items: { type: "string" } },
              recommendedActions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "reason", "priority", "actionType", "requiresHumanConfirmation"],
                  properties: {
                    title: { type: "string" },
                    reason: { type: "string" },
                    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                    actionType: {
                      type: "string",
                      enum: ["createTask", "createOperationalAlert", "notifyUser", "reviewOnly"],
                    },
                    targetEntityType: { type: ["string", "null"] },
                    targetEntityId: { type: ["string", "null"] },
                    requiresHumanConfirmation: { type: "boolean", enum: [true] },
                  },
                },
              },
              followUpQuestions: { type: "array", items: { type: "string" } },
              toolsUsed: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are Kal, an MSO operations copilot. Use only provided structured context. No PHI, no patient details, no autonomous actions. Every suggested action must require human confirmation. Be concise and operationally actionable.",
        },
        {
          role: "user",
          content: JSON.stringify({
            question: sanitizeUserQuery(input.query),
            context: input.context,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError("Kal AI request failed", "INTERNAL", 502, {
      status: response.status,
      body: body.slice(0, 400),
    });
  }

  const json = (await response.json()) as OpenAIChatCompletionsResponse;
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new AppError("Kal AI response was empty", "INTERNAL", 502);
  return kalAnswerSchema.parse(JSON.parse(raw));
}

export async function askKal(
  ctx: ServiceContext,
  input: {
    query: string;
    organizationId?: string;
    clinicId?: string;
    intent: KalIntent;
    includeContext?: boolean;
    model?: string;
  },
) {
  const context = await buildKalContext(ctx, {
    organizationId: input.organizationId,
    clinicId: input.clinicId,
    intent: input.intent,
    query: input.query,
  });
  await requirePermission(ctx.actorUserId, Permissions.aiAssistant.read, {
    scope: "ORGANIZATION",
    organizationId: context.organizationId,
  });

  const answer =
    env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0
      ? await callOpenAIKal({ query: input.query, context, model: input.model })
      : fallbackFromContext({ query: input.query, context });

  await writeAuditLog({
    ctx: { ...ctx, organizationId: context.organizationId, clinicId: context.clinicId ?? undefined },
    action: "CREATE",
    entityType: "KalQuery",
    entityId: `${Date.now()}`,
    organizationId: context.organizationId,
    clinicId: context.clinicId ?? null,
    metadata: {
      intent: input.intent,
      queryLength: input.query.length,
      toolCount: context.tools.length,
      recommendationCount: answer.recommendedActions.length,
    },
  });

  logger.info("Kal query executed", {
    actorUserId: ctx.actorUserId,
    organizationId: context.organizationId,
    clinicId: context.clinicId,
    intent: input.intent,
    toolsUsed: answer.toolsUsed,
  });

  return {
    answer,
    context: input.includeContext ? context : undefined,
  };
}

export async function explainReimbursementVariance(
  ctx: ServiceContext,
  input: { query: string; organizationId?: string; clinicId?: string },
) {
  return askKal(ctx, { ...input, intent: "reimbursement" });
}

export async function suggestOperationalActions(
  ctx: ServiceContext,
  input: { query: string; organizationId?: string; clinicId?: string },
) {
  return askKal(ctx, { ...input, intent: "operations" });
}

export async function explainBenchmarkingResults(
  ctx: ServiceContext,
  input: { query: string; organizationId?: string; clinicId?: string },
) {
  return askKal(ctx, { ...input, intent: "benchmarking" });
}

export async function assistClinicOnboarding(
  ctx: ServiceContext,
  input: { query: string; organizationId?: string; clinicId?: string },
) {
  return askKal(ctx, { ...input, intent: "onboarding" });
}

export async function explainPredictedRevenueRisk(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; query?: string },
) {
  const [forecast, kal] = await Promise.all([
    predictExpectedRevenue(ctx, input),
    askKal(ctx, {
      query:
        input.query ??
        "Explain predicted revenue risk and which drivers are most likely to change forecast outcomes.",
      organizationId: input.organizationId,
      clinicId: input.clinicId,
      intent: "predictive",
    }),
  ]);
  logger.info("Kal predictive revenue explanation executed", {
    actorUserId: ctx.actorUserId,
    organizationId: forecast.organizationId,
    clinicId: input.clinicId,
  });
  return { forecast, explanation: kal.answer };
}

export async function explainPredictedPaymentDelay(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; query?: string },
) {
  const [prediction, kal] = await Promise.all([
    predictPaymentTimeline(ctx, input),
    askKal(ctx, {
      query:
        input.query ??
        "Explain predicted payment delay risk by clinic and what actions can reduce reimbursement lag.",
      organizationId: input.organizationId,
      clinicId: input.clinicId,
      intent: "predictive",
    }),
  ]);
  logger.info("Kal predictive payment-delay explanation executed", {
    actorUserId: ctx.actorUserId,
    organizationId: input.organizationId,
    clinicId: input.clinicId,
  });
  return { prediction, explanation: kal.answer };
}

export async function explainClinicOperationalForecast(
  ctx: ServiceContext,
  input: { organizationId?: string; clinicId?: string; query?: string },
) {
  const [prediction, kal] = await Promise.all([
    predictClinicOperationalRisk(ctx, input),
    askKal(ctx, {
      query:
        input.query ??
        "Explain clinic operational forecast risk and identify the top risk drivers for the next operating cycle.",
      organizationId: input.organizationId,
      clinicId: input.clinicId,
      intent: "predictive",
    }),
  ]);
  logger.info("Kal predictive clinic-forecast explanation executed", {
    actorUserId: ctx.actorUserId,
    organizationId: input.organizationId,
    clinicId: input.clinicId,
  });
  return { prediction, explanation: kal.answer };
}
