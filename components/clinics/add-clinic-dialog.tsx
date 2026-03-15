"use client";

import * as React from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  clinicType: z.enum(["PRIMARY_CARE", "PSYCHIATRY", "HOSPITAL_OUTPATIENT", "SPECIALTY"]),
  status: z.enum(["PROSPECT", "ONBOARDING", "ACTIVE", "PAUSED"]),
});

type Values = z.infer<typeof schema>;

export function AddClinicDialog(props: { organizationId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      slug: "",
      clinicType: "PRIMARY_CARE",
      status: "PROSPECT",
    },
  });

  async function onSubmit(values: Values) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/clinics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: props.organizationId, ...values }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Failed to create clinic.");
        return;
      }
      setOpen(false);
      form.reset();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add clinic</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add clinic</DialogTitle>
          <DialogDescription>Create a new clinic workspace in Kalevea.</DialogDescription>
        </DialogHeader>

        <form className="mt-4 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="name">Clinic name</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name?.message ? (
              <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" placeholder="northside-primary-care" {...form.register("slug")} />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Used in URLs. Lowercase letters, numbers, and hyphens only.
            </p>
            {form.formState.errors.slug?.message ? (
              <p className="text-sm text-red-600">{form.formState.errors.slug.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Clinic type</Label>
              <Select
                value={form.watch("clinicType")}
                onValueChange={(v) => form.setValue("clinicType", v as Values["clinicType"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY_CARE">Primary Care</SelectItem>
                  <SelectItem value="PSYCHIATRY">Psychiatry</SelectItem>
                  <SelectItem value="HOSPITAL_OUTPATIENT">Hospital Outpatient</SelectItem>
                  <SelectItem value="SPECIALTY">Specialty</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as Values["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROSPECT">Prospect</SelectItem>
                  <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create clinic"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

