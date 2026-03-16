"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const statuses = ["DRAFT", "SUBMITTED", "PENDING_PAYER", "APPROVED", "DENIED", "CANCELLED"] as const;

export function UpdatePAStatusForm(props: {
  caseId: string;
  currentStatus: (typeof statuses)[number];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const status = String(formData.get("status") ?? "");
      const note = String(formData.get("note") ?? "").trim();
      const documentIdsInput = String(formData.get("documentIds") ?? "").trim();
      const documentIds = documentIdsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch(`/api/prior-auth/cases/${props.caseId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status,
          note: note || undefined,
          documentIds: documentIds.length > 0 ? documentIds : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to update status.");
        return;
      }

      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="status">Case status</Label>
        <select
          id="status"
          name="status"
          defaultValue={props.currentStatus}
          className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="documentIds">Attach document IDs (optional)</Label>
        <input
          id="documentIds"
          name="documentIds"
          placeholder="docId1,docId2"
          className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Status note (optional)</Label>
        <Textarea id="note" name="note" rows={3} />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Updating..." : "Update status"}
      </Button>
    </form>
  );
}
