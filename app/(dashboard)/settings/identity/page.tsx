import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IdentityAdminPanel } from "@/components/settings/identity-admin-panel";
import { AppError } from "@/lib/utils/errors";
import { prisma } from "@/lib/db/prisma";
import { listMembersAndInvites } from "@/server/services/auth/invite.service";
import { getAccessSnapshot } from "@/server/services/auth/auth.service";

export default async function IdentitySettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await getAccessSnapshot(session.user.id);
  const organizationId = access.defaultOrganizationId;
  if (!organizationId) {
    throw new AppError("No organization access configured", "UNAUTHORIZED", 403);
  }

  const [members, roles, clinics] = await Promise.all([
    listMembersAndInvites({ actorUserId: session.user.id, organizationId }, { organizationId }),
    prisma.role.findMany({
      where: { scope: { in: ["ORGANIZATION", "CLINIC"] } },
      orderBy: [{ scope: "asc" }, { key: "asc" }],
      select: { key: true, name: true, scope: true },
    }),
    prisma.clinic.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Identity Admin</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage organization invites and member access (Phase 2A.1 stub).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members and invites</CardTitle>
          <CardDescription>
            Create pending invites, inspect membership scope, and revoke/resend pending invites.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IdentityAdminPanel
            organizationId={organizationId}
            members={members}
            roles={roles
              .filter((role) => role.scope === "ORGANIZATION" || role.scope === "CLINIC")
              .map((role) => ({
                key: role.key,
                name: role.name,
                scope: role.scope as "ORGANIZATION" | "CLINIC",
              }))}
            clinics={clinics}
          />
        </CardContent>
      </Card>
    </div>
  );
}
