"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ClinicOption = {
  id: string;
  name: string;
};

type UploadResponse = {
  uploadUrl: string;
  storageKey: string;
  requiredHeaders: Record<string, string>;
};

export function EraUploadForm({ clinics }: { clinics: ClinicOption[] }) {
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clinicId || !file) return;

    setError("");
    setResult("");
    setIsSubmitting(true);

    try {
      const uploadRes = await fetch("/api/era/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          filename: file.name,
          mimeType: file.type || "application/edi-x12",
          size: file.size,
          title: `ERA ${file.name}`,
        }),
      });
      if (!uploadRes.ok) throw new Error("Failed to request ERA upload URL");
      const uploadJson = (await uploadRes.json()) as UploadResponse;

      const putRes = await fetch(uploadJson.uploadUrl, {
        method: "PUT",
        headers: uploadJson.requiredHeaders,
        body: file,
      });
      if (!putRes.ok) throw new Error("Failed to upload ERA file to storage");

      const processRes = await fetch("/api/era/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          storageKey: uploadJson.storageKey,
          mimeType: file.type || "application/edi-x12",
          fileSize: file.size,
          title: `ERA ${file.name}`,
        }),
      });
      if (!processRes.ok) throw new Error("Failed to parse and reconcile ERA file");
      const processJson = (await processRes.json()) as {
        reconciliation?: { matchedCount: number; unmatchedCount: number; reconciliationStatus: string };
      };
      const reconciliation = processJson.reconciliation;
      if (reconciliation) {
        setResult(
          `Reconciliation complete: ${reconciliation.reconciliationStatus} (${reconciliation.matchedCount} matched, ${reconciliation.unmatchedCount} unmatched).`,
        );
      } else {
        setResult("ERA file processed successfully.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error processing ERA file";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-4">
      <div className="grid gap-2">
        <Label>Clinic</Label>
        <Select value={clinicId} onValueChange={setClinicId}>
          <SelectTrigger>
            <SelectValue placeholder="Select clinic" />
          </SelectTrigger>
          <SelectContent>
            {clinics.map((clinic) => (
              <SelectItem key={clinic.id} value={clinic.id}>
                {clinic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2 md:col-span-2">
        <Label htmlFor="era-file">835 file</Label>
        <Input
          id="era-file"
          type="file"
          accept=".txt,.835,.edi,.x12,text/plain,application/edi-x12"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          required
        />
      </div>
      <div className="flex items-end">
        <Button type="submit" className="w-full" disabled={isSubmitting || !clinicId || !file}>
          {isSubmitting ? "Processing..." : "Upload + Process"}
        </Button>
      </div>

      {result ? <p className="md:col-span-4 text-sm text-emerald-600">{result}</p> : null}
      {error ? <p className="md:col-span-4 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
