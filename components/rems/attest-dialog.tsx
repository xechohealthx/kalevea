"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { RemsAppliesToType, RemsRequirementType } from "@prisma/client";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Requirement = {
  id: string;
  appliesToType: RemsAppliesToType;
  requirementType: RemsRequirementType;
  title: string;
};

export function RemsAttestDialog(props: {
  clinicId: string;
  remsProgramId: string;
  requirements: Requirement[];
  providers: Array<{ id: string; name: string }>;
  defaultAppliesTo?: "CLINIC" | "PROVIDER";
  defaultProviderId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [providerId, setProviderId] = React.useState<string>(props.defaultProviderId ?? "");
  const [requirementId, setRequirementId] = React.useState<string>("");
  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const appliesTo: "CLINIC" | "PROVIDER" = providerId ? "PROVIDER" : "CLINIC";

  const requirementOptions = props.requirements.filter(
    (r) => r.appliesToType === appliesTo && r.requirementType === "ATTESTATION",
  );

  React.useEffect(() => {
    const req = requirementOptions.find((r) => r.id === requirementId);
    if (req && !title) setTitle(req.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirementId]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/rems/attestations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          remsProgramId: props.remsProgramId,
          clinicId: props.clinicId,
          providerId: providerId || null,
          remsRequirementId: requirementId || null,
          title: title.trim() || "Attestation",
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Failed to record attestation.");
        return;
      }
      setOpen(false);
      setRequirementId("");
      setTitle("");
      setNotes("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Record attestation</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record attestation</DialogTitle>
          <DialogDescription>Operational compliance note (no PHI).</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Applies to</Label>
            <Select
              value={providerId ? "PROVIDER" : "CLINIC"}
              onValueChange={(v) => {
                if (v === "CLINIC") setProviderId("");
                if (v === "PROVIDER" && props.providers[0]) setProviderId(props.providers[0].id);
                setRequirementId("");
                setTitle("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLINIC">Clinic</SelectItem>
                <SelectItem value="PROVIDER">Provider</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {providerId ? (
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={providerId} onValueChange={(v) => setProviderId(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {props.providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Requirement (optional)</Label>
            <Select value={requirementId} onValueChange={(v) => setRequirementId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select requirement" />
              </SelectTrigger>
              <SelectContent>
                {requirementOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save attestation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

