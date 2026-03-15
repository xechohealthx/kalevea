"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function TicketCommentForm(props: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${props.ticketId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, isInternal: false }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Failed to add comment.");
        return;
      }
      setBody("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="comment">Add comment</Label>
      <Textarea
        id="comment"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Add an operational update (no PHI)…"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={submitting || !body.trim()}>
          {submitting ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </div>
  );
}

