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
type PAOption = { id: string };

export function CreateBuyAndBillCaseDialog(props: {
  clinics: ClinicOption[];
  medications: MedicationOption[];
  priorAuthCases: PAOption[];
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
        patientReferenceId: String(formData.get("patientReferenceId") ?? "").trim() || undefined,
        priorAuthorizationCaseId: String(formData.get("priorAuthorizationCaseId") ?? "").trim() || undefined,
        expectedPayerName: String(formData.get("expectedPayerName") ?? "").trim() || undefined,
        expectedReimbursementAmount:
          String(formData.get("expectedReimbursementAmount") ?? "").trim() || undefined,
        initialNote: String(formData.get("initialNote") ?? "").trim() || undefined,
      };

      const res = await fetch("/api/buy-and-bill/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to create case.");
        return;
      }

      const caseId = json?.data?.id;
      setOpen(false);
      router.push(caseId ? `/buy-and-bill?caseId=${caseId}` : "/buy-and-bill");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Case</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create buy-and-bill case</DialogTitle>
          <DialogDescription>Operational tracking only. Do not include PHI details.</DialogDescription>
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
            <Label htmlFor="patientReferenceId">Patient reference ID</Label>
            <Input id="patientReferenceId" name="patientReferenceId" placeholder="External reference only" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priorAuthorizationCaseId">Linked prior auth case ID (optional)</Label>
            <input
              id="priorAuthorizationCaseId"
              name="priorAuthorizationCaseId"
              list="pa-case-options"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
            <datalist id="pa-case-options">
              {props.priorAuthCases.map((p) => (
                <option key={p.id} value={p.id} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expectedPayerName">Expected payer</Label>
            <Input id="expectedPayerName" name="expectedPayerName" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expectedReimbursementAmount">Expected reimbursement</Label>
            <Input id="expectedReimbursementAmount" name="expectedReimbursementAmount" type="number" step="0.01" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="initialNote">Initial note</Label>
            <textarea
              id="initialNote"
              name="initialNote"
              rows={3}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create case"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
