"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const statuses = ["DRAFT", "SUBMITTED", "ACCEPTED", "REJECTED", "PENDING", "PAID", "DENIED"] as const;

export function CreateClaimRecordForm(props: { caseId: string; payerName: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const submittedAtRaw = String(formData.get("submittedAt") ?? "").trim();
      const payload = {
        externalClaimId: String(formData.get("externalClaimId") ?? "").trim() || undefined,
        claimNumber: String(formData.get("claimNumber") ?? "").trim() || undefined,
        payerName: String(formData.get("payerName") ?? ""),
        submittedAt: submittedAtRaw ? new Date(submittedAtRaw).toISOString() : undefined,
        status: String(formData.get("status") ?? "DRAFT"),
        billedAmount: String(formData.get("billedAmount") ?? "").trim() || undefined,
        notes: String(formData.get("notes") ?? "").trim() || undefined,
      };
      const res = await fetch(`/api/reimbursement/cases/${props.caseId}/claims`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to create claim record.");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="externalClaimId">External claim ID</Label>
          <input
            id="externalClaimId"
            name="externalClaimId"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="claimNumber">Claim number</Label>
          <input
            id="claimNumber"
            name="claimNumber"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="payerName">Payer</Label>
          <input
            id="payerName"
            name="payerName"
            defaultValue={props.payerName}
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue="DRAFT"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="submittedAt">Submitted at</Label>
          <input
            id="submittedAt"
            name="submittedAt"
            type="datetime-local"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billedAmount">Billed amount</Label>
          <input
            id="billedAmount"
            name="billedAmount"
            type="number"
            step="0.01"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create claim record"}
      </Button>
    </form>
  );
}
