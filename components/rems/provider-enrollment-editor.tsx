"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statuses = ["NOT_ENROLLED", "PENDING", "ENROLLED", "SUSPENDED", "EXPIRED"] as const;

export function ProviderEnrollmentEditor(props: {
  providerId: string;
  remsProgramId: string;
  status: string | null;
  expiresAt: Date | string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<string>(props.status ?? "PENDING");
  const [expiresAt, setExpiresAt] = React.useState<string>(() => {
    if (!props.expiresAt) return "";
    const d = props.expiresAt instanceof Date ? props.expiresAt : new Date(props.expiresAt);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/rems/providers/${props.providerId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          remsProgramId: props.remsProgramId,
          status,
          expiresAt: expiresAt ? new Date(expiresAt + "T00:00:00Z").toISOString() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Failed to update enrollment.");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v)}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="expiresAt">Expires</Label>
        <Input id="expiresAt" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      </div>
      <div className="flex items-end">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600 sm:col-span-3">{error}</p> : null}
    </div>
  );
}

