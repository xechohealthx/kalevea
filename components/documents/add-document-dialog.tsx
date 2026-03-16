"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  scope: z.enum(["CLINIC", "ORGANIZATION"]),
  clinicId: z.string().optional(),
  organizationId: z.string().optional(),
  category: z.enum([
    "CONTRACT",
    "ONBOARDING",
    "TRAINING",
    "COMPLIANCE",
    "SUPPORT",
    "GENERAL",
    "ERA_REMITTANCE",
  ]),
  title: z.string().min(2),
});

type Values = z.infer<typeof schema>;

async function computeSha256Hex(file: File) {
  try {
    if (!("crypto" in globalThis) || !globalThis.crypto?.subtle) return undefined;
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}

export function AddDocumentDialog(props: {
  clinics: Array<{ id: string; name: string }>;
  defaultOrganizationId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      scope: props.clinics.length > 0 ? "CLINIC" : "ORGANIZATION",
      clinicId: props.clinics[0]?.id ?? undefined,
      organizationId: props.defaultOrganizationId ?? undefined,
      category: "GENERAL",
      title: "",
    },
  });

  async function onSubmit(values: Values) {
    setSubmitting(true);
    setError(null);
    try {
      if (!file) {
        setError("Please select a file to upload.");
        return;
      }

      const checksumSha256 = await computeSha256Hex(file);
      const requestPayload =
        values.scope === "CLINIC"
          ? {
              clinicId: values.clinicId,
              organizationId: values.organizationId,
              filename: file.name,
              mimeType: file.type || "application/octet-stream",
              size: file.size,
              checksumSha256,
              category: values.category,
              title: values.title,
            }
          : {
              organizationId: values.organizationId,
              filename: file.name,
              mimeType: file.type || "application/octet-stream",
              size: file.size,
              checksumSha256,
              category: values.category,
              title: values.title,
            };

      const uploadUrlRes = await fetch("/api/documents/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestPayload),
      });
      const uploadUrlJson = await uploadUrlRes.json();
      if (!uploadUrlRes.ok) {
        setError(uploadUrlJson?.error?.message ?? "Failed to request upload URL.");
        return;
      }

      const uploadRes = await fetch(uploadUrlJson.data.uploadUrl, {
        method: "PUT",
        headers: uploadUrlJson.data.requiredHeaders ?? {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!uploadRes.ok) {
        setError("Direct upload to storage failed.");
        return;
      }

      const finalizePayload =
        values.scope === "CLINIC"
          ? {
              clinicId: values.clinicId,
              organizationId: values.organizationId,
              storageKey: uploadUrlJson.data.storageKey,
              mimeType: file.type || "application/octet-stream",
              fileSize: file.size,
              checksumSha256: requestPayload.checksumSha256,
              category: values.category,
              title: values.title,
            }
          : {
              organizationId: values.organizationId,
              storageKey: uploadUrlJson.data.storageKey,
              mimeType: file.type || "application/octet-stream",
              fileSize: file.size,
              checksumSha256: requestPayload.checksumSha256,
              category: values.category,
              title: values.title,
            };

      const finalizeRes = await fetch("/api/documents/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(finalizePayload),
      });
      const finalizeJson = await finalizeRes.json();
      if (!finalizeRes.ok) {
        setError(finalizeJson?.error?.message ?? "Failed to finalize upload.");
        return;
      }

      setOpen(false);
      form.reset({ ...form.getValues(), title: "" });
      setFile(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const scope = form.watch("scope");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add document</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add document metadata</DialogTitle>
          <DialogDescription>
            This is the server-side metadata layer. File storage integration is an extension point.
          </DialogDescription>
        </DialogHeader>

        <form className="mt-4 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => form.setValue("scope", v as Values["scope"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLINIC">Clinic</SelectItem>
                  <SelectItem value="ORGANIZATION">Organization</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === "CLINIC" ? (
              <div className="space-y-2">
                <Label>Clinic</Label>
                <Select
                  value={form.watch("clinicId") ?? ""}
                  onValueChange={(v) => form.setValue("clinicId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select clinic" />
                  </SelectTrigger>
                  <SelectContent>
                    {props.clinics.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Organization</Label>
                <Input
                  value={form.watch("organizationId") ?? ""}
                  onChange={(e) => form.setValue("organizationId", e.target.value)}
                  placeholder="org id"
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.watch("category")}
                onValueChange={(v) => form.setValue("category", v as Values["category"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="CONTRACT">Contract</SelectItem>
                  <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                  <SelectItem value="TRAINING">Training</SelectItem>
                  <SelectItem value="COMPLIANCE">Compliance</SelectItem>
                  <SelectItem value="SUPPORT">Support</SelectItem>
                  <SelectItem value="ERA_REMITTANCE">ERA Remittance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register("title")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              type="file"
              onChange={(e) => {
                const nextFile = e.target.files?.[0] ?? null;
                setFile(nextFile);
              }}
            />
            {file ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {file.name} ({file.size.toLocaleString()} bytes)
              </p>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save metadata"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

