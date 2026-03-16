"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type OrganizationOption = {
  id: string;
  name: string;
};

type ClinicOption = {
  id: string;
  name: string;
};

type RuleRow = {
  id: string;
  payerName: string;
  ruleCategory: string;
  title: string;
  isActive: boolean;
  confidenceLevel: string;
  clinic?: { id: string; name: string } | null;
  expectedReimbursementAmount?: number | null;
  expectedReimbursementMin?: number | null;
  expectedReimbursementMax?: number | null;
};

type SuggestionRow = {
  id: string;
  payerName: string;
  status: string;
  model: string;
  createdAt: string | Date;
  suggestedRuleJSON: unknown;
  sourceDocument?: { id: string; title: string } | null;
};

export function PayerRulesAdminPanel({
  organizations,
  clinics,
  rules,
  suggestions,
}: {
  organizations: OrganizationOption[];
  clinics: ClinicOption[];
  rules: RuleRow[];
  suggestions: SuggestionRow[];
}) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const defaultOrganizationId = organizations[0]?.id ?? "";
  const [organizationId, setOrganizationId] = useState(defaultOrganizationId);
  const [clinicId, setClinicId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [category, setCategory] = useState("REIMBURSEMENT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [expectedMin, setExpectedMin] = useState("");
  const [expectedMax, setExpectedMax] = useState("");
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [extractPayerName, setExtractPayerName] = useState("");

  const draftSuggestions = useMemo(
    () => suggestions.filter((suggestion) => suggestion.status === "DRAFT"),
    [suggestions],
  );

  async function onCreateRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsBusy(true);
    try {
      const res = await fetch("/api/payer-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organizationId || undefined,
          clinicId: clinicId || undefined,
          payerName,
          ruleCategory: category,
          title,
          description: description || undefined,
          expectedReimbursementAmount: expectedAmount ? Number(expectedAmount) : undefined,
          expectedReimbursementMin: expectedMin ? Number(expectedMin) : undefined,
          expectedReimbursementMax: expectedMax ? Number(expectedMax) : undefined,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create payer rule");
      setMessage("Payer rule created.");
      setPayerName("");
      setTitle("");
      setDescription("");
      setExpectedAmount("");
      setExpectedMin("");
      setExpectedMax("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payer rule");
    } finally {
      setIsBusy(false);
    }
  }

  async function onRunExtract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsBusy(true);
    try {
      const res = await fetch("/api/payer-rules/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          documentId: sourceDocumentId,
          payerName: extractPayerName || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to extract payer rule suggestions");
      setMessage("AI extraction complete. Review draft suggestions below.");
      setSourceDocumentId("");
      setExtractPayerName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract rules");
    } finally {
      setIsBusy(false);
    }
  }

  async function approveSuggestion(id: string) {
    setIsBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/payer-rules/suggestions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activate: true }),
      });
      if (!res.ok) throw new Error("Failed to approve suggestion");
      setMessage("Suggestion approved and converted to payer rule.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve suggestion");
    } finally {
      setIsBusy(false);
    }
  }

  async function rejectSuggestion(id: string) {
    setIsBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/payer-rules/suggestions/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to reject suggestion");
      setMessage("Suggestion rejected.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject suggestion");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <form onSubmit={onCreateRule} className="grid gap-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-medium">Create payer rule</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-2">
            <Label>Organization</Label>
            <select
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Clinic (optional)</Label>
            <select
              value={clinicId}
              onChange={(event) => setClinicId(event.target.value)}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All clinics</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Category</Label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="AUTHORIZATION">Authorization</option>
              <option value="REIMBURSEMENT">Reimbursement</option>
              <option value="DOCUMENTATION">Documentation</option>
              <option value="OPERATIONAL">Operational</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Payer</Label>
            <Input value={payerName} onChange={(event) => setPayerName(event.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-2">
            <Label>Expected amount</Label>
            <Input type="number" step="0.01" value={expectedAmount} onChange={(event) => setExpectedAmount(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Expected min</Label>
            <Input type="number" step="0.01" value={expectedMin} onChange={(event) => setExpectedMin(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Expected max</Label>
            <Input type="number" step="0.01" value={expectedMax} onChange={(event) => setExpectedMax(event.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isBusy}>
            Create rule
          </Button>
        </div>
      </form>

      <form onSubmit={onRunExtract} className="grid gap-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-medium">AI extraction</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-2">
            <Label>Organization</Label>
            <select
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Source document ID</Label>
            <Input value={sourceDocumentId} onChange={(event) => setSourceDocumentId(event.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label>Payer hint (optional)</Label>
            <Input value={extractPayerName} onChange={(event) => setExtractPayerName(event.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isBusy}>
            Extract suggestions
          </Button>
        </div>
      </form>

      <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="mb-3 text-sm font-medium">Draft suggestions</h3>
        <div className="space-y-3">
          {draftSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">
                  {suggestion.payerName} · {suggestion.model}
                </div>
                <div className="text-xs text-zinc-500">{new Date(suggestion.createdAt).toLocaleString()}</div>
              </div>
              {suggestion.sourceDocument ? (
                <p className="mt-1 text-xs text-zinc-500">Source: {suggestion.sourceDocument.title}</p>
              ) : null}
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-zinc-950 p-2 text-xs text-zinc-100">
                {JSON.stringify(suggestion.suggestedRuleJSON, null, 2)}
              </pre>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => approveSuggestion(suggestion.id)} disabled={isBusy}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => rejectSuggestion(suggestion.id)} disabled={isBusy}>
                  Reject
                </Button>
              </div>
            </div>
          ))}
          {draftSuggestions.length === 0 ? (
            <p className="text-sm text-zinc-500">No draft suggestions.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="mb-3 text-sm font-medium">Existing payer rules</h3>
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <div className="font-medium">
                {rule.payerName} · {rule.ruleCategory} · {rule.title}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {rule.clinic ? `Clinic: ${rule.clinic.name} · ` : ""}
                Confidence: {rule.confidenceLevel} · Active: {rule.isActive ? "Yes" : "No"}
              </div>
              {rule.expectedReimbursementAmount !== null && rule.expectedReimbursementAmount !== undefined ? (
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Expected: ${Number(rule.expectedReimbursementAmount).toFixed(2)}
                </div>
              ) : null}
            </div>
          ))}
          {rules.length === 0 ? <p className="text-sm text-zinc-500">No payer rules found.</p> : null}
        </div>
      </div>
    </div>
  );
}
