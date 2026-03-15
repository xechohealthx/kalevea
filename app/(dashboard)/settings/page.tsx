import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await getAccessSnapshot(session.user.id);
  const org = access.defaultOrganizationId
    ? await prisma.organization.findUnique({
        where: { id: access.defaultOrganizationId },
      })
    : null;

  const roles = await prisma.role.findMany({ orderBy: [{ scope: "asc" }, { key: "asc" }] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Organization settings, RBAC visibility, and placeholders for future configuration.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              Name: <span className="font-medium">{org?.name ?? "—"}</span>
            </div>
            <div>
              Slug: <span className="font-mono">{org?.slug ?? "—"}</span>
            </div>
            <div>
              Type: <Badge variant="outline">{org?.type ?? "—"}</Badge>
            </div>
            <div className="pt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Organization configuration will expand as modules (PA, Buy & Bill, REMS, Claims, Inventory) plug in.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clinic settings (placeholder)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
            Clinic-level configuration will live here (notifications, contacts, operational preferences, module toggles).
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles & scopes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div>
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{r.key}</div>
              </div>
              <Badge variant="secondary">{r.scope}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

