import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

import { hydrateIdentity } from "@/lib/auth/identity";

export type SessionContext = {
  userId: string;
  email: string;
  name: string;
  activeOrganizationId: string | null;
  activeClinicId: string | null;
  roleSummary: {
    globalRoles: string[];
    organizationRoleCount: number;
    clinicRoleCount: number;
  };
};

export async function buildSessionContext(
  userId: string,
  preferred?: { organizationId?: string | null; clinicId?: string | null },
): Promise<SessionContext | null> {
  const identity = await hydrateIdentity(userId, preferred);
  if (!identity) return null;

  return {
    userId: identity.user.id,
    email: identity.user.email,
    name: identity.user.name,
    activeOrganizationId: identity.activeOrganizationId,
    activeClinicId: identity.activeClinicId,
    roleSummary: identity.roleSummary,
  };
}

export function applyContextToToken(token: JWT, context: SessionContext): JWT {
  token.userId = context.userId;
  token.email = context.email;
  token.name = context.name;
  token.activeOrganizationId = context.activeOrganizationId ?? undefined;
  token.activeClinicId = context.activeClinicId ?? undefined;
  token.roleSummary = context.roleSummary;
  return token;
}

export function applyTokenToSession(session: Session, token: JWT): Session {
  if (!session.user || !token.userId) return session;
  session.user.id = token.userId as string;
  session.user.email = (token.email as string | undefined) ?? null;
  session.user.name = (token.name as string | undefined) ?? null;
  session.user.activeOrganizationId = (token.activeOrganizationId as string | undefined) ?? null;
  session.user.activeClinicId = (token.activeClinicId as string | undefined) ?? null;
  session.user.roleSummary = (token.roleSummary as Session["user"]["roleSummary"] | undefined) ?? {
    globalRoles: [],
    organizationRoleCount: 0,
    clinicRoleCount: 0,
  };
  return session;
}
