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
import { Textarea } from "@/components/ui/textarea";

type ClinicOption = { id: string; name: string };

export function CreatePACaseDialog(props: {
  clinics: ClinicOption[];
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
      const clinicId = String(formData.get("clinicId") ?? "");
      const payerName = String(formData.get("payerName") ?? "");
      const medicationName = String(formData.get("medicationName") ?? "");
      const patientReferenceId = String(formData.get("patientReferenceId") ?? "").trim();
      const initialNote = String(formData.get("initialNote") ?? "").trim();
      const documentIdsInput = String(formData.get("documentIds") ?? "").trim();
      const documentIds = documentIdsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/prior-auth/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clinicId,
          payerName,
          medicationName,
          patientReferenceId: patientReferenceId || undefined,
          initialNote: initialNote || undefined,
          documentIds: documentIds.length > 0 ? documentIds : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to create PA case.");
        return;
      }

      const caseId = json?.data?.id;
      setOpen(false);
      router.push(caseId ? `/prior-auth?caseId=${caseId}` : "/prior-auth");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create PA Case</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create prior authorization case</DialogTitle>
          <DialogDescription>
            Operational case record only. Do not include PHI details in this form.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinicId">Clinic</Label>
            <select
              id="clinicId"
              name="clinicId"
              defaultValue={props.selectedClinicId ?? props.clinics[0]?.id ?? ""}
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              required
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
            <Input id="payerName" name="payerName" placeholder="Example: BlueCross BlueShield" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medicationName">Medication</Label>
            <Input id="medicationName" name="medicationName" placeholder="Example: Spravato" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="patientReferenceId">Patient reference ID (external)</Label>
            <Input id="patientReferenceId" name="patientReferenceId" placeholder="External reference only" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="documentIds">Document IDs to attach (optional)</Label>
            <Input id="documentIds" name="documentIds" placeholder="docId1,docId2" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="initialNote">Initial note (optional)</Label>
            <Textarea id="initialNote" name="initialNote" rows={3} />
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
