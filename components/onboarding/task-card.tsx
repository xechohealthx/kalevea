"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Task = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  dueDate: string | Date | null;
};

export function OnboardingTaskCard({ task }: { task: Task }) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function updateStatus(status: Task["status"]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Failed to update task.");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const due =
    task.dueDate instanceof Date
      ? task.dueDate
      : task.dueDate
        ? new Date(task.dueDate)
        : null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm">{task.title}</CardTitle>
          <Badge variant="outline">{task.category}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {task.description ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{task.description}</p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Due: {due ? due.toLocaleDateString() : "—"}
          </div>
          <Select value={task.status} onValueChange={(v) => updateStatus(v as Task["status"])}>
            <SelectTrigger className="h-9 w-40" disabled={saving}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODO">TODO</SelectItem>
              <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
              <SelectItem value="BLOCKED">BLOCKED</SelectItem>
              <SelectItem value="DONE">DONE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

