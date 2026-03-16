"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type LotOption = {
  id: string;
  lotNumber: string;
  quantityRemaining: number;
};

export function RecordMedicationAdministrationForm(props: {
  caseId: string;
  lots: LotOption[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        medicationLotId: String(formData.get("medicationLotId") ?? ""),
        administeredAt: new Date(String(formData.get("administeredAt") ?? "")).toISOString(),
        unitsAdministered: Number(formData.get("unitsAdministered") ?? 0),
        notes: String(formData.get("notes") ?? "").trim() || undefined,
      };

      const res = await fetch(`/api/buy-and-bill/cases/${props.caseId}/administrations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to record administration.");
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
        <Label htmlFor="medicationLotId">Medication lot</Label>
        <select
          id="medicationLotId"
          name="medicationLotId"
          className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          {props.lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.lotNumber} (remaining: {lot.quantityRemaining})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="administeredAt">Administered at</Label>
        <input
          id="administeredAt"
          name="administeredAt"
          type="datetime-local"
          className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="unitsAdministered">Units administered</Label>
        <input
          id="unitsAdministered"
          name="unitsAdministered"
          type="number"
          min={1}
          className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          required
        />
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
      <Button type="submit" disabled={submitting || props.lots.length === 0}>
        {submitting ? "Recording..." : "Record administration"}
      </Button>
    </form>
  );
}
