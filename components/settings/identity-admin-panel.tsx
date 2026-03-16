"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RoleOption = {
  key: string;
  name: string;
  scope: "ORGANIZATION" | "CLINIC";
};

type ClinicOption = {
  id: string;
  name: string;
};

type MemberRow = {
  userId: string;
  name: string;
  email: string;
  invitationStatus: "PENDING" | "ACCEPTED" | "REVOKED";
  authProviderType: string | null;
  isActive: boolean;
  organizationRoles: Array<{ roleKey: string; roleName: string }>;
  clinicScopes: Array<{ clinicId: string; clinicName: string; roleKeys: string[]; roleNames: string[] }>;
  invitedAt: string | Date | null;
  acceptedAt: string | Date | null;
};

export function IdentityAdminPanel({
  organizationId,
  members,
  roles,
  clinics,
}: {
  organizationId: string;
  members: MemberRow[];
  roles: RoleOption[];
  clinics: ClinicOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    email: "",
    firstName: "",
    lastName: "",
    roleKey: roles[0]?.key ?? "",
    clinicId: "",
  });

  const selectedRole = React.useMemo(
    () => roles.find((r) => r.key === form.roleKey) ?? null,
    [roles, form.roleKey],
  );

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      email: form.email.trim(),
      firstName: form.firstName.trim() || undefined,
      lastName: form.lastName.trim() || undefined,
      organizationId,
      clinicId: selectedRole?.scope === "CLINIC" ? form.clinicId || undefined : undefined,
      roleKey: form.roleKey,
    };

    const res = await fetch("/api/identity/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Failed to create invite. Check permission scope and payload.");
      return;
    }

    setForm({
      email: "",
      firstName: "",
      lastName: "",
      roleKey: roles[0]?.key ?? "",
      clinicId: "",
    });
    router.refresh();
  }

  async function invokeInviteAction(inviteId: string, action: "revoke" | "resend") {
    setError(null);
    const res = await fetch(`/api/identity/invites/${inviteId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    if (!res.ok) {
      setError(`Failed to ${action} invite.`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submitInvite} className="grid gap-3 rounded-md border border-zinc-200 p-4 md:grid-cols-6 dark:border-zinc-800">
        <input
          required
          type="email"
          placeholder="user@example.com"
          value={form.email}
          onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
        <input
          type="text"
          placeholder="First name (optional)"
          value={form.firstName}
          onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))}
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
        <input
          type="text"
          placeholder="Last name (optional)"
          value={form.lastName}
          onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))}
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
        <select
          value={form.roleKey}
          onChange={(e) => setForm((s) => ({ ...s, roleKey: e.target.value, clinicId: "" }))}
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          {roles.map((role) => (
            <option key={role.key} value={role.key}>
              {role.name} ({role.scope})
            </option>
          ))}
        </select>
        <select
          disabled={selectedRole?.scope !== "CLINIC"}
          value={form.clinicId}
          onChange={(e) => setForm((s) => ({ ...s, clinicId: e.target.value }))}
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="">Clinic scope (optional)</option>
          {clinics.map((clinic) => (
            <option key={clinic.id} value={clinic.id}>
              {clinic.name}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={loading}>
          {loading ? "Inviting..." : "Create invite"}
        </Button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Member</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Roles</th>
              <th className="px-3 py-2 text-left font-medium">Provider</th>
              <th className="px-3 py-2 text-left font-medium">Dates</th>
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.userId} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-3">
                  <div className="font-medium">{member.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{member.email}</div>
                </td>
                <td className="px-3 py-3">
                  <Badge variant={member.invitationStatus === "PENDING" ? "warning" : member.invitationStatus === "REVOKED" ? "danger" : "success"}>
                    {member.invitationStatus}
                  </Badge>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {member.isActive ? "Active" : "Inactive"}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="text-xs">
                    Org: {member.organizationRoles.map((r) => r.roleKey).join(", ") || "—"}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Clinics:{" "}
                    {member.clinicScopes.length > 0
                      ? member.clinicScopes.map((c) => `${c.clinicName} [${c.roleKeys.join(", ")}]`).join("; ")
                      : "—"}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs">{member.authProviderType ?? "—"}</td>
                <td className="px-3 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                  <div>Invited: {member.invitedAt ? new Date(member.invitedAt).toLocaleDateString() : "—"}</div>
                  <div>Accepted: {member.acceptedAt ? new Date(member.acceptedAt).toLocaleDateString() : "—"}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={member.invitationStatus !== "PENDING"}
                      onClick={() => invokeInviteAction(member.userId, "resend")}
                    >
                      Resend
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={member.invitationStatus !== "PENDING"}
                      onClick={() => invokeInviteAction(member.userId, "revoke")}
                    >
                      Revoke
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  No members or invites found for this organization.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
