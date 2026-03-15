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
  category: z.enum(["CONTRACT", "ONBOARDING", "TRAINING", "COMPLIANCE", "SUPPORT", "GENERAL"]),
  title: z.string().min(2),
  mimeType: z.string().min(3),
  fileSize: z.number().int().nonnegative(),
  fileName: z.string().min(1),
});

type Values = z.infer<typeof schema>;

export function AddDocumentDialog(props: {
  clinics: Array<{ id: string; name: string }>;
  defaultOrganizationId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      scope: "CLINIC",
      clinicId: props.clinics[0]?.id ?? undefined,
      organizationId: props.defaultOrganizationId ?? undefined,
      category: "GENERAL",
      title: "",
      mimeType: "application/pdf",
      fileSize: 0,
      fileName: "",
    },
  });

  async function onSubmit(values: Values) {
    setSubmitting(true);
    setError(null);
    try {
      const storageKey = `uploads/${values.scope.toLowerCase()}/${Date.now()}-${values.fileName.replace(/\s+/g, "-")}`;
      const payload =
        values.scope === "CLINIC"
          ? {
              clinicId: values.clinicId,
              category: values.category,
              title: values.title,
              storageKey,
              mimeType: values.mimeType,
              fileSize: values.fileSize,
            }
          : {
              organizationId: values.organizationId,
              category: values.category,
              title: values.title,
              storageKey,
              mimeType: values.mimeType,
              fileSize: values.fileSize,
            };

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Failed to create document metadata.");
        return;
      }
      setOpen(false);
      form.reset({ ...form.getValues(), title: "", fileName: "", fileSize: 0 });
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
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mimeType">MIME type</Label>
              <Input id="mimeType" {...form.register("mimeType")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register("title")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fileName">File name</Label>
              <Input id="fileName" placeholder="document.pdf" {...form.register("fileName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileSize">File size (bytes)</Label>
              <Input
                id="fileSize"
                type="number"
                {...form.register("fileSize", { valueAsNumber: true })}
              />
            </div>
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

