import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProviderRemsOverview } from "@/server/services/rems/rems.service";
import { ProviderEnrollmentEditor } from "@/components/rems/provider-enrollment-editor";
import { RemsAttestDialog } from "@/components/rems/attest-dialog";

function StatusBadge({ status }: { status: string | null }) {
  const v: BadgeProps["variant"] =
    status === "ENROLLED"
      ? "success"
      : status === "PENDING"
        ? "warning"
        : status === "EXPIRED"
          ? "danger"
          : status === "SUSPENDED"
            ? "secondary"
            : "outline";
  return <Badge variant={v}>{status ?? "—"}</Badge>;
}

export default async function ProviderRemsPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { providerId } = await params;
  const data = await getProviderRemsOverview({ actorUserId: session.user.id }, providerId);

  const requirementOptions = data.requirements.map((r) => ({
    id: r.id,
    appliesToType: r.appliesToType,
    requirementType: r.requirementType,
    title: r.title,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {data.provider.firstName} {data.provider.lastName} — REMS
            </h1>
            <Badge variant="secondary">{data.program.name}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Provider enrollment, requirements, and attestations.
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Clinic:{" "}
            <Link className="underline" href={`/rems/clinics/${data.provider.clinic.id}`}>
              {data.provider.clinic.name}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RemsAttestDialog
            clinicId={data.provider.clinicId}
            remsProgramId={data.program.id}
            requirements={requirementOptions}
            providers={[{ id: data.provider.id, name: `${data.provider.firstName} ${data.provider.lastName}` }]}
            defaultProviderId={data.provider.id}
          />
          <Link
            href="/rems"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Back to REMS
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Enrollment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div>
                Status: <StatusBadge status={data.enrollment?.status ?? null} />
              </div>
              <div className="text-zinc-600 dark:text-zinc-400">
                Expires:{" "}
                <span className="font-medium text-zinc-950 dark:text-zinc-50">
                  {data.enrollment?.expiresAt ? new Date(data.enrollment.expiresAt).toLocaleDateString() : "—"}
                </span>
              </div>
            </div>

            <ProviderEnrollmentEditor
              providerId={data.provider.id}
              remsProgramId={data.program.id}
              status={data.enrollment?.status ?? null}
              expiresAt={data.enrollment?.expiresAt ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              Total requirements:{" "}
              <span className="font-medium">{data.readiness.totalRequirements}</span>
            </div>
            <div>
              Attestable requirements:{" "}
              <span className="font-medium">{data.readiness.attestableRequirements}</span>
            </div>
            <div>
              Attested (MVP):{" "}
              <span className="font-medium">{data.readiness.attestedRequirements}</span>
            </div>
            <div>
              Upcoming expirations (30d):{" "}
              <span className="font-medium">{data.readiness.upcomingExpirations30d}</span>
            </div>
            <div>
              Expired enrollment:{" "}
              <span className="font-medium">{data.readiness.expiredEnrollments}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.requirements.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                    {r.requirementType}
                  </TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.isRequired ? "Yes" : "No"}</TableCell>
                  <TableCell>{r.isActive ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
              {data.requirements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-zinc-500">
                    No requirements configured.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attestations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.attestations.map((a) => (
              <div key={a.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-zinc-500">{new Date(a.attestedAt).toLocaleString()}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Attested by {a.attestedBy.firstName} {a.attestedBy.lastName}
                  {a.requirement ? ` · Requirement: ${a.requirement.title}` : ""}
                </div>
                {a.notes ? <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{a.notes}</div> : null}
              </div>
            ))}
            {data.attestations.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">No attestations yet.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.activity.map((e) => (
              <div key={e.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium">{e.title}</div>
                  <div className="text-xs text-zinc-500">{new Date(e.createdAt).toLocaleString()}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{e.type}</div>
                {e.description ? (
                  <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{e.description}</div>
                ) : null}
              </div>
            ))}
            {data.activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">No activity yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

