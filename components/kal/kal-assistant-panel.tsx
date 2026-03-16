"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type OrganizationOption = { id: string; name: string };
type ClinicOption = { id: string; name: string };
type KalIntent =
  | "general"
  | "reimbursement"
  | "operations"
  | "benchmarking"
  | "onboarding"
  | "prior_auth"
  | "revenue"
  | "predictive";

type KalAnswer = {
  summary: string;
  keyFindings: string[];
  recommendedActions: Array<{
    title: string;
    reason: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    actionType: "createTask" | "createOperationalAlert" | "notifyUser" | "reviewOnly";
    targetEntityType?: string | null;
    targetEntityId?: string | null;
    requiresHumanConfirmation: true;
  }>;
  followUpQuestions: string[];
  toolsUsed: string[];
};

type Insight = {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  title: string;
  message: string;
};

type OnboardingReadiness = {
  projectId: string;
  clinicName: string;
  progressPct: number;
  readinessBand: "NOT_READY" | "AT_RISK" | "READY";
  missingAreas: string[];
  blockedTaskCount: number;
};

const QUICK_TEMPLATES: Array<{ label: string; intent: KalIntent; query: string }> = [
  {
    label: "Payment delay diagnosis",
    intent: "benchmarking",
    query: "Why is this clinic getting paid slower than others and what should operations do first?",
  },
  {
    label: "PA attention list",
    intent: "prior_auth",
    query: "Which PA cases need attention today and what follow-up actions are recommended?",
  },
  {
    label: "Underpayment root cause",
    intent: "reimbursement",
    query: "What is causing the current underpayment pattern and what should billing review first?",
  },
  {
    label: "Onboarding next steps",
    intent: "onboarding",
    query: "What steps remain to finish onboarding this clinic and what blockers should be escalated?",
  },
  {
    label: "Predictive risk outlook",
    intent: "predictive",
    query: "Which clinics are predicted to face the highest operational and payment delay risk next cycle?",
  },
];

export function KalAssistantPanel({
  organizations,
  clinics,
  defaultOrganizationId,
  defaultClinicId,
  initialContextToolNames,
  initialIntent,
  initialQuery,
  screenContextLabel,
}: {
  organizations: OrganizationOption[];
  clinics: ClinicOption[];
  defaultOrganizationId: string;
  defaultClinicId?: string;
  initialContextToolNames: string[];
  initialIntent?: KalIntent;
  initialQuery?: string;
  screenContextLabel?: string;
}) {
  const [organizationId, setOrganizationId] = useState(defaultOrganizationId);
  const [clinicId, setClinicId] = useState(defaultClinicId ?? "");
  const [intent, setIntent] = useState<KalIntent>(initialIntent ?? "general");
  const [query, setQuery] = useState(initialQuery ?? "Why is this clinic getting paid slower than others?");
  const [includeContext, setIncludeContext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [explainBusy, setExplainBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<KalAnswer | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [recommendations, setRecommendations] = useState<KalAnswer["recommendedActions"]>([]);
  const [onboardingReadiness, setOnboardingReadiness] = useState<OnboardingReadiness[]>([]);

  const filteredClinics = useMemo(() => clinics, [clinics]);

  useEffect(() => {
    let cancelled = false;
    async function loadEnhancements() {
      try {
        const [insightRes, recommendationRes, onboardingRes] = await Promise.all([
          fetch(
            `/api/ai/kal/insights?organizationId=${encodeURIComponent(organizationId)}${
              clinicId ? `&clinicId=${encodeURIComponent(clinicId)}` : ""
            }`,
          ),
          fetch(
            `/api/ai/kal/recommendations?organizationId=${encodeURIComponent(organizationId)}${
              clinicId ? `&clinicId=${encodeURIComponent(clinicId)}` : ""
            }`,
          ),
          fetch(
            `/api/ai/kal/onboarding-analysis?organizationId=${encodeURIComponent(organizationId)}${
              clinicId ? `&clinicId=${encodeURIComponent(clinicId)}` : ""
            }`,
          ),
        ]);
        if (!insightRes.ok || !recommendationRes.ok || !onboardingRes.ok) return;

        const insightPayload = (await insightRes.json()) as {
          data: { clinicInsights: Insight[]; payerInsights: Insight[]; revenueInsights: Insight[] };
        };
        const recommendationPayload = (await recommendationRes.json()) as {
          data: KalAnswer["recommendedActions"];
        };
        const onboardingPayload = (await onboardingRes.json()) as {
          data: { readiness: OnboardingReadiness[] };
        };
        if (cancelled) return;
        const combinedInsights = [
          ...insightPayload.data.clinicInsights,
          ...insightPayload.data.payerInsights,
          ...insightPayload.data.revenueInsights,
        ].slice(0, 8);
        setInsights(combinedInsights);
        setRecommendations(recommendationPayload.data.slice(0, 8));
        setOnboardingReadiness(onboardingPayload.data.readiness.slice(0, 6));
      } catch {
        if (!cancelled) {
          setInsights([]);
          setRecommendations([]);
          setOnboardingReadiness([]);
        }
      }
    }
    loadEnhancements();
    return () => {
      cancelled = true;
    };
  }, [organizationId, clinicId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/kal/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          clinicId: clinicId || undefined,
          intent,
          query,
          includeContext,
        }),
      });
      const payload = (await res.json()) as
        | { data: { answer: KalAnswer } }
        | { error: { message?: string } };
      if (!res.ok || !("data" in payload)) {
        throw new Error("error" in payload ? payload.error.message ?? "Kal query failed" : "Kal query failed");
      }
      setAnswer(payload.data.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kal query failed");
    } finally {
      setBusy(false);
    }
  }

  async function explainScreen() {
    setExplainBusy(true);
    setError("");
    try {
      const target =
        intent === "benchmarking"
          ? "clinic_performance"
          : intent === "reimbursement"
            ? "reimbursement_variance"
            : intent === "revenue"
              ? "underpayment_signal"
              : "dashboard";
      const res = await fetch("/api/ai/kal/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          clinicId: clinicId || undefined,
          target,
          query: screenContextLabel
            ? `Explain this page context (${screenContextLabel}) and identify anomalies and operator next steps.`
            : undefined,
        }),
      });
      const payload = (await res.json()) as
        | { data: KalAnswer | { explanation: KalAnswer } }
        | { error: { message?: string } };
      if (!res.ok || !("data" in payload)) {
        throw new Error("error" in payload ? payload.error.message ?? "Kal explain failed" : "Kal explain failed");
      }
      const result = "explanation" in payload.data ? payload.data.explanation : payload.data;
      setAnswer(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kal explain failed");
    } finally {
      setExplainBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ask Kal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((template) => (
              <button
                key={template.label}
                type="button"
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => {
                  setIntent(template.intent);
                  setQuery(template.query);
                }}
              >
                {template.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium">Explain this screen</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {screenContextLabel
                  ? `Context: ${screenContextLabel}`
                  : "Generate an explanation of this dashboard context and what to investigate."}
              </p>
            </div>
            <Button type="button" variant="outline" disabled={explainBusy} onClick={explainScreen}>
              {explainBusy ? "Explaining..." : "Explain this page"}
            </Button>
          </div>

          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-3">
              <select
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <select
                value={clinicId}
                onChange={(event) => setClinicId(event.target.value)}
                className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="">All clinics</option>
                {filteredClinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </select>
              <select
                value={intent}
                onChange={(event) => setIntent(event.target.value as KalIntent)}
                className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="general">General ops</option>
                <option value="operations">Operations</option>
                <option value="prior_auth">Prior auth</option>
                <option value="reimbursement">Reimbursement</option>
                <option value="revenue">Revenue</option>
                <option value="benchmarking">Benchmarking</option>
                <option value="onboarding">Onboarding</option>
                <option value="predictive">Predictive</option>
              </select>
            </div>

            <Input value={query} onChange={(event) => setQuery(event.target.value)} />

            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(event) => setIncludeContext(event.target.checked)}
              />
              Include context payload in API response (debug use)
            </label>

            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? "Analyzing..." : "Ask Kal"}
              </Button>
            </div>
          </form>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contextual insights</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {insights.map((insight) => (
            <div key={`${insight.title}-${insight.message}`} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant={insight.severity === "HIGH" ? "warning" : insight.severity === "MEDIUM" ? "secondary" : "outline"}>
                  {insight.severity}
                </Badge>
                <span className="text-sm font-medium">{insight.title}</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{insight.message}</p>
            </div>
          ))}
          {insights.length === 0 ? <p className="text-sm text-zinc-500">No insight cards available for this scope yet.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Onboarding readiness summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {onboardingReadiness.map((row) => (
            <div key={row.projectId} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{row.clinicName}</div>
                <Badge
                  variant={row.readinessBand === "READY" ? "success" : row.readinessBand === "AT_RISK" ? "warning" : "danger"}
                >
                  {row.readinessBand}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {row.progressPct.toFixed(0)}% complete · {row.blockedTaskCount} blocked tasks
              </p>
              {row.missingAreas.length > 0 ? (
                <p className="mt-1 text-xs text-zinc-500">Missing: {row.missingAreas.join(", ")}</p>
              ) : null}
            </div>
          ))}
          {onboardingReadiness.length === 0 ? (
            <p className="text-sm text-zinc-500">No onboarding readiness records for current scope.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Assistant response</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {answer ? (
            <>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{answer.summary}</p>

              <div>
                <h3 className="text-sm font-medium">Key findings</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                  {answer.keyFindings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-medium">Recommended actions (human-confirmed)</h3>
                <div className="mt-2 space-y-2">
                  {answer.recommendedActions.map((action) => (
                    <div key={`${action.title}-${action.reason}`} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Badge variant={action.priority === "HIGH" ? "warning" : action.priority === "MEDIUM" ? "secondary" : "outline"}>
                          {action.priority}
                        </Badge>
                        <span className="text-sm font-medium">{action.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{action.reason}</p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {action.actionType} · confirmation required
                        {action.targetEntityType ? ` · ${action.targetEntityType}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium">Follow-up questions</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                  {answer.followUpQuestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-zinc-500">Tools used: {answer.toolsUsed.join(", ")}</p>
            </>
          ) : (
            <div className="text-sm text-zinc-500">
              Ask a question to generate a context-aware operational response from Kal.
              {initialContextToolNames.length > 0 ? (
                <div className="mt-2 text-xs">Available context tools: {initialContextToolNames.join(", ")}</div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quick recommended actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recommendations.map((action) => (
            <div key={`${action.title}-${action.reason}`} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Badge variant={action.priority === "HIGH" ? "warning" : action.priority === "MEDIUM" ? "secondary" : "outline"}>
                  {action.priority}
                </Badge>
                <span className="text-sm font-medium">{action.title}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{action.reason}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{action.actionType} · requires human confirmation</p>
            </div>
          ))}
          {recommendations.length === 0 ? (
            <p className="text-sm text-zinc-500">No generated quick actions in this scope.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
