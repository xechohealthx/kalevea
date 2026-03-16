"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type ClaimOption = { id: string; claimNumber: string | null; status: string };

export function CreatePaymentRecordForm(props: {
  caseId: string;
  claims: ClaimOption[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        claimRecordId: String(formData.get("claimRecordId") ?? "").trim() || undefined,
        paidAmount: Number(formData.get("paidAmount") ?? 0),
        paidDate: new Date(String(formData.get("paidDate") ?? "")).toISOString(),
        sourceType: String(formData.get("sourceType") ?? "MANUAL"),
        referenceNumber: String(formData.get("referenceNumber") ?? "").trim() || undefined,
        notes: String(formData.get("notes") ?? "").trim() || undefined,
      };
      const res = await fetch(`/api/reimbursement/cases/${props.caseId}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to create payment record.");
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
          <Label htmlFor="claimRecordId">Linked claim (optional)</Label>
          <select
            id="claimRecordId"
            name="claimRecordId"
            defaultValue=""
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">No specific claim</option>
            {props.claims.map((c) => (
              <option key={c.id} value={c.id}>
                {c.claimNumber ?? c.id.slice(0, 10)} · {c.status}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sourceType">Source type</Label>
          <select
            id="sourceType"
            name="sourceType"
            defaultValue="MANUAL"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="MANUAL">MANUAL</option>
            <option value="ERA_IMPORTED">ERA_IMPORTED</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="paidAmount">Paid amount</Label>
          <input
            id="paidAmount"
            name="paidAmount"
            type="number"
            step="0.01"
            min={0.01}
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paidDate">Paid date</Label>
          <input
            id="paidDate"
            name="paidDate"
            type="date"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            required
          />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="referenceNumber">Reference number</Label>
          <input
            id="referenceNumber"
            name="referenceNumber"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <input
            id="notes"
            name="notes"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Recording..." : "Record payment"}
      </Button>
    </form>
  );
}
