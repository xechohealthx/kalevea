"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ClinicOption = { id: string; name: string };
type MedicationOption = { id: string; name: string; ndc: string | null };

export function CreateMedicationLotDialog(props: {
  clinics: ClinicOption[];
  medications: MedicationOption[];
  selectedClinicId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        clinicId: String(formData.get("clinicId") ?? ""),
        medicationCatalogItemId: String(formData.get("medicationCatalogItemId") ?? ""),
        lotNumber: String(formData.get("lotNumber") ?? ""),
        expirationDate: new Date(String(formData.get("expirationDate") ?? "")).toISOString(),
        acquisitionDate: new Date(String(formData.get("acquisitionDate") ?? "")).toISOString(),
        quantityReceived: Number(formData.get("quantityReceived") ?? 0),
        supplierName: String(formData.get("supplierName") ?? "").trim() || undefined,
        invoiceReference: String(formData.get("invoiceReference") ?? "").trim() || undefined,
      };

      const res = await fetch("/api/buy-and-bill/lots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to create lot.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Create Lot</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create medication lot</DialogTitle>
          <DialogDescription>Records acquired inventory for clinic administration workflows.</DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="clinicId">Clinic</Label>
            <select
              id="clinicId"
              name="clinicId"
              defaultValue={props.selectedClinicId ?? props.clinics[0]?.id ?? ""}
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              {props.clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="medicationCatalogItemId">Medication</Label>
            <select
              id="medicationCatalogItemId"
              name="medicationCatalogItemId"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              {props.medications.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.ndc ? ` (${m.ndc})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lotNumber">Lot number</Label>
            <Input id="lotNumber" name="lotNumber" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantityReceived">Quantity received</Label>
            <Input id="quantityReceived" name="quantityReceived" type="number" min={1} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acquisitionDate">Acquisition date</Label>
            <Input id="acquisitionDate" name="acquisitionDate" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expirationDate">Expiration date</Label>
            <Input id="expirationDate" name="expirationDate" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplierName">Supplier (optional)</Label>
            <Input id="supplierName" name="supplierName" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceReference">Invoice reference (optional)</Label>
            <Input id="invoiceReference" name="invoiceReference" />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create lot"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
