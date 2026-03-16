"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type OrganizationOption = {
  id: string;
  name: string;
};

type RuleRow = {
  id: string;
  ruleType: string;
  isActive: boolean;
  conditionConfig: unknown;
  actionConfig: unknown;
  createdAt: Date | string;
};

type EventRow = {
  id: string;
  ruleId: string;
  targetEntityType: string;
  targetEntityId: string;
  actionExecuted: string;
  status: string;
  triggeredAt: Date | string;
  errorMessage?: string | null;
};

export function AutomationAdminPanel({
  organizations,
  defaultOrganizationId,
  rules,
  events,
}: {
  organizations: OrganizationOption[];
  defaultOrganizationId: string;
  rules: RuleRow[];
  events: EventRow[];
}) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState(defaultOrganizationId);
  const [ruleType, setRuleType] = useState("UNDERPAYMENT_ALERT");
  const [conditionConfig, setConditionConfig] = useState('{"threshold": 1000}');
  const [actionType, setActionType] = useState("createOperationalAlert");
  const [actionMessage, setActionMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsBusy(true);
    try {
      const condition = JSON.parse(conditionConfig) as Record<string, unknown>;
      const actionConfig: Record<string, unknown> = { actionType };
      if (actionMessage.trim()) actionConfig.message = actionMessage.trim();

      const res = await fetch("/api/automation/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          ruleType,
          conditionConfig: condition,
          actionConfig,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create automation rule");
      setMessage("Automation rule created.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleRule(ruleId: string, nextActive: boolean) {
    setError("");
    setMessage("");
    setIsBusy(true);
    try {
      const res = await fetch(`/api/automation/rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (!res.ok) throw new Error("Failed to update rule");
      setMessage(`Rule ${nextActive ? "enabled" : "disabled"}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update rule");
    } finally {
      setIsBusy(false);
    }
  }

  async function runAutomation(ruleId?: string) {
    setError("");
    setMessage("");
    setIsBusy(true);
    try {
      const res = await fetch("/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, ruleId }),
      });
      if (!res.ok) throw new Error("Failed to run automation");
      const payload = (await res.json()) as { ruleCount: number };
      setMessage(`Automation run complete. Evaluated ${payload.ruleCount} rules.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run automation");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <form onSubmit={createRule} className="grid gap-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-medium">Create automation rule</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-2">
            <Label>Organization</Label>
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
          </div>
          <div className="grid gap-2">
            <Label>Rule type</Label>
            <select
              value={ruleType}
              onChange={(event) => setRuleType(event.target.value)}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="UNDERPAYMENT_ALERT">Underpayment alert</option>
              <option value="PA_STUCK_ALERT">PA stuck alert</option>
              <option value="PAYMENT_DELAY_ALERT">Payment delay alert</option>
              <option value="DOCUMENTATION_MISSING">Documentation missing</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Action</Label>
            <select
              value={actionType}
              onChange={(event) => setActionType(event.target.value)}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="createOperationalAlert">Create operational alert</option>
              <option value="createTask">Create task</option>
              <option value="notifyUser">Notify user (activity)</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Condition config (JSON)</Label>
            <Textarea rows={5} value={conditionConfig} onChange={(event) => setConditionConfig(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Action message (optional)</Label>
            <Input value={actionMessage} onChange={(event) => setActionMessage(event.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isBusy}>Create rule</Button>
        </div>
      </form>

      <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">Automation rules</h3>
          <Button size="sm" onClick={() => runAutomation()} disabled={isBusy}>
            Run all rules
          </Button>
        </div>
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{rule.ruleType}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => runAutomation(rule.id)} disabled={isBusy}>
                    Run
                  </Button>
                  <Button size="sm" onClick={() => toggleRule(rule.id, !rule.isActive)} disabled={isBusy}>
                    {rule.isActive ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-zinc-500">Created {new Date(rule.createdAt).toLocaleString()}</p>
              <pre className="mt-2 max-h-28 overflow-auto rounded bg-zinc-950 p-2 text-xs text-zinc-100">
                {JSON.stringify(rule.conditionConfig, null, 2)}
              </pre>
            </div>
          ))}
          {rules.length === 0 ? <p className="text-sm text-zinc-500">No automation rules defined yet.</p> : null}
        </div>
      </div>

      <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="mb-3 text-sm font-medium">Recent automation events</h3>
        <div className="space-y-2">
          {events.map((eventRow) => (
            <div key={eventRow.id} className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">
                  {eventRow.actionExecuted} · {eventRow.targetEntityType}
                </div>
                <div className="text-xs text-zinc-500">{new Date(eventRow.triggeredAt).toLocaleString()}</div>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Rule {eventRow.ruleId.slice(0, 8)}... · Target {eventRow.targetEntityId.slice(0, 10)}... · {eventRow.status}
              </p>
              {eventRow.errorMessage ? <p className="mt-1 text-xs text-red-600">{eventRow.errorMessage}</p> : null}
            </div>
          ))}
          {events.length === 0 ? <p className="text-sm text-zinc-500">No automation events yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
