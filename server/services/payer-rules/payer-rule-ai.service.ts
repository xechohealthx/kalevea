import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { Permissions } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/check";
import { AppError } from "@/lib/utils";
import { writeAuditLog } from "@/server/services/audit/audit.service";
import { readObjectAsText } from "@/server/services/storage/s3.service";
import type { ServiceContext } from "@/server/services/service-context";

import type { PayerRuleCategory } from "./payer-rule.types";

const candidateSchema = z.object({
  payerName: z.string().trim().min(2).max(120),
  ruleCategory: z.enum(["AUTHORIZATION", "REIMBURSEMENT", "DOCUMENTATION", "OPERATIONAL"]),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  stateCode: z.string().trim().length(2).toUpperCase().optional(),
  serviceContext: z.string().trim().max(120).optional(),
  expectedReimbursementAmount: z.number().positive().max(1_000_000).optional(),
  expectedReimbursementMin: z.number().positive().max(1_000_000).optional(),
  expectedReimbursementMax: z.number().positive().max(1_000_000).optional(),
  confidenceLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  sourceType: z.enum(["AI_SUGGESTED"]).default("AI_SUGGESTED"),
});

const extractionResultSchema = z.object({
  candidates: z.array(candidateSchema).max(20),
});

type OpenAIChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function assertOpenAIConfigured() {
  if (!env.OPENAI_API_KEY) {
    throw new AppError(
      "OPENAI_API_KEY is not configured",
      "VALIDATION_ERROR",
      400,
      { code: "OPENAI_NOT_CONFIGURED" },
    );
  }
}

async function callOpenAIExtractCandidates(input: {
  text: string;
  payerNameHint?: string;
  model?: string;
}) {
  assertOpenAIConfigured();

  const model = input.model ?? env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const truncatedText = input.text.slice(0, 40_000);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "payer_rule_candidates",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              candidates: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    payerName: { type: "string" },
                    ruleCategory: {
                      type: "string",
                      enum: ["AUTHORIZATION", "REIMBURSEMENT", "DOCUMENTATION", "OPERATIONAL"],
                    },
                    title: { type: "string" },
                    description: { type: "string" },
                    stateCode: { type: "string" },
                    serviceContext: { type: "string" },
                    expectedReimbursementAmount: { type: "number" },
                    expectedReimbursementMin: { type: "number" },
                    expectedReimbursementMax: { type: "number" },
                    confidenceLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                    sourceType: { type: "string", enum: ["AI_SUGGESTED"] },
                  },
                  required: [
                    "payerName",
                    "ruleCategory",
                    "title",
                    "confidenceLevel",
                    "sourceType",
                  ],
                },
              },
            },
            required: ["candidates"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Extract payer operational rules from policy text into structured JSON. Do not include patient-level data. Return only document-grounded rules.",
        },
        {
          role: "user",
          content: [
            input.payerNameHint ? `Payer name hint: ${input.payerNameHint}` : "",
            "Document text:",
            truncatedText,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError("OpenAI extraction request failed", "INTERNAL", 502, {
      status: response.status,
      body: body.slice(0, 500),
    });
  }

  const json = (await response.json()) as OpenAIChatCompletionsResponse;
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) {
    throw new AppError("OpenAI returned no extraction content", "INTERNAL", 502);
  }
  const parsed = extractionResultSchema.parse(JSON.parse(raw));
  return { model, parsed };
}

export async function extractPayerRuleCandidatesFromDocument(
  ctx: ServiceContext,
  input: {
    organizationId: string;
    documentId: string;
    payerName?: string;
    model?: string;
  },
) {
  await requirePermission(ctx.actorUserId, Permissions.payerRules.manage, {
    scope: "ORGANIZATION",
    organizationId: input.organizationId,
  });

  const document = await prisma.document.findUnique({
    where: { id: input.documentId },
    select: { id: true, organizationId: true, title: true, storageKey: true, clinicId: true },
  });
  if (!document) throw new AppError("Source document not found", "NOT_FOUND", 404);
  if (document.organizationId !== input.organizationId) {
    throw new AppError("Source document is outside organization scope", "UNAUTHORIZED", 403);
  }

  const text = await readObjectAsText({ storageKey: document.storageKey });
  if (!text.trim()) {
    throw new AppError("Source document text is empty", "VALIDATION_ERROR", 400);
  }

  const { model, parsed } = await callOpenAIExtractCandidates({
    text,
    payerNameHint: input.payerName,
    model: input.model,
  });

  const created = await prisma.$transaction(
    parsed.candidates.map((candidate) =>
      prisma.payerRuleSuggestion.create({
        data: {
          organizationId: input.organizationId,
          payerName: candidate.payerName,
          suggestedRuleJSON: candidate,
          sourceDocumentId: document.id,
          model,
          status: "DRAFT",
          createdByUserId: ctx.actorUserId,
        },
      }),
    ),
  );

  await writeAuditLog({
    ctx: { ...ctx, organizationId: input.organizationId, clinicId: document.clinicId ?? undefined },
    action: "CREATE",
    entityType: "PayerRuleSuggestionBatch",
    entityId: `${created.length}`,
    organizationId: input.organizationId,
    clinicId: document.clinicId,
    metadata: { sourceDocumentId: document.id, model, count: created.length },
  });
  logger.info("AI payer rule extraction completed", {
    organizationId: input.organizationId,
    sourceDocumentId: document.id,
    suggestionCount: created.length,
    model,
  });

  return {
    model,
    sourceDocumentId: document.id,
    suggestionCount: created.length,
    suggestions: created,
  };
}

export async function summarizePayerRuleEvidence(
  ctx: ServiceContext,
  input: { organizationId: string; payerName: string; category?: PayerRuleCategory; model?: string },
) {
  await requirePermission(ctx.actorUserId, Permissions.payerRules.read, {
    scope: "ORGANIZATION",
    organizationId: input.organizationId,
  });

  const rules = await prisma.payerRule.findMany({
    where: {
      organizationId: input.organizationId,
      payerName: { equals: input.payerName, mode: "insensitive" },
      ruleCategory: input.category,
    },
    include: {
      evidence: {
        include: { document: { select: { id: true, title: true } } },
        orderBy: [{ createdAt: "desc" }],
        take: 10,
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 20,
  });

  if (rules.length === 0) {
    return {
      summary: "No payer rule evidence found for the provided scope.",
      sourceCount: 0,
      model: "deterministic",
    };
  }

  const evidenceText = rules
    .flatMap((rule) =>
      rule.evidence.map((evidence) => ({
        payerRuleId: rule.id,
        title: rule.title,
        category: rule.ruleCategory,
        docTitle: evidence.document.title,
        sourceLabel: evidence.sourceLabel,
        note: evidence.note,
      })),
    )
    .slice(0, 40);

  if (!env.OPENAI_API_KEY) {
    const fallback = evidenceText
      .slice(0, 8)
      .map((e, idx) => `${idx + 1}. [${e.category}] ${e.title} (${e.docTitle})`)
      .join("\n");
    return {
      summary: `OpenAI not configured. Evidence highlights:\n${fallback}`,
      sourceCount: evidenceText.length,
      model: "deterministic",
    };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "Summarize payer rule evidence for an operations team. Keep it concise, factual, and avoid any PHI.",
        },
        {
          role: "user",
          content: JSON.stringify(evidenceText),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new AppError("OpenAI evidence summary failed", "INTERNAL", 502);
  }
  const json = (await response.json()) as OpenAIChatCompletionsResponse;
  return {
    summary: json.choices?.[0]?.message?.content ?? "No summary returned.",
    sourceCount: evidenceText.length,
    model: input.model ?? env.OPENAI_MODEL ?? "gpt-4.1-mini",
  };
}
