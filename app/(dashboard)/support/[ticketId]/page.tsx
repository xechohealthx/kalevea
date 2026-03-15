import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTicket } from "@/server/services/support/support.service";
import { TicketCommentForm } from "@/components/support/comment-form";

export default async function TicketDetailPage({
  params,
}: {
  params: { ticketId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const ticket = await getTicket({ actorUserId: session.user.id }, params.ticketId);

  const statusVariant: BadgeProps["variant"] =
    ticket.status === "OPEN"
      ? "warning"
      : ticket.status === "RESOLVED"
        ? "success"
        : "secondary";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
          <Badge variant="outline">{ticket.category}</Badge>
          <Badge variant="secondary">{ticket.priority}</Badge>
          <Badge variant={statusVariant}>
            {ticket.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Clinic: <span className="font-medium">{ticket.clinic.name}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-700 dark:text-zinc-300">
          {ticket.description}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.comments.map((c) => (
            <div key={c.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">
                  {c.user ? `${c.user.firstName} ${c.user.lastName}` : "System"}
                  {c.isInternal ? (
                    <Badge variant="outline" className="ml-2">
                      Internal
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-zinc-500">
                  {new Date(c.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{c.body}</div>
            </div>
          ))}

          {ticket.comments.length === 0 ? (
            <p className="text-sm text-zinc-500">No comments yet.</p>
          ) : null}

          <div className="pt-2">
            <TicketCommentForm ticketId={ticket.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

