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
type LinkOption = { id: string };

export function CreateReimbursementCaseDialog(props: {
  clinics: ClinicOption[];
  buyAndBillCases: LinkOption[];
  priorAuthCases: LinkOption[];
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
        buyAndBillCaseId: String(formData.get("buyAndBillCaseId") ?? "").trim() || undefined,
        priorAuthorizationCaseId: String(formData.get("priorAuthorizationCaseId") ?? "").trim() || undefined,
        patientReferenceId: String(formData.get("patientReferenceId") ?? "").trim() || undefined,
        payerName: String(formData.get("payerName") ?? ""),
        expectedAmount: Number(formData.get("expectedAmount") ?? 0),
        expectedAllowedAmount: String(formData.get("expectedAllowedAmount") ?? "").trim() || undefined,
        initialNote: String(formData.get("initialNote") ?? "").trim() || undefined,
      };

      const res = await fetch("/api/reimbursement/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to create reimbursement case.");
        return;
      }
      const caseId = json?.data?.id;
      setOpen(false);
      router.push(caseId ? `/reimbursement?caseId=${caseId}` : "/reimbursement");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Reimbursement Case</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create reimbursement case</DialogTitle>
          <DialogDescription>Operational financial visibility record (no PHI).</DialogDescription>
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
            <Label htmlFor="payerName">Payer</Label>
            <Input id="payerName" name="payerName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expectedAmount">Expected amount</Label>
            <Input id="expectedAmount" name="expectedAmount" type="number" step="0.01" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expectedAllowedAmount">Expected allowed amount (optional)</Label>
            <Input id="expectedAllowedAmount" name="expectedAllowedAmount" type="number" step="0.01" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="patientReferenceId">Patient reference ID</Label>
            <Input id="patientReferenceId" name="patientReferenceId" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyAndBillCaseId">Buy-and-bill case link (optional)</Label>
            <input
              id="buyAndBillCaseId"
              name="buyAndBillCaseId"
              list="bnb-case-options"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
            <datalist id="bnb-case-options">
              {props.buyAndBillCases.map((c) => (
                <option key={c.id} value={c.id} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priorAuthorizationCaseId">Prior auth case link (optional)</Label>
            <input
              id="priorAuthorizationCaseId"
              name="priorAuthorizationCaseId"
              list="pa-case-options"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
            <datalist id="pa-case-options">
              {props.priorAuthCases.map((c) => (
                <option key={c.id} value={c.id} />
              ))}
            </datalist>
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
