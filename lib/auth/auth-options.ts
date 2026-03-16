import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { z } from "zod";

import { buildSessionContext, applyContextToToken, applyTokenToSession } from "@/lib/auth/session";
import { markUserAuthenticated } from "@/lib/auth/identity";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function getCredentialsProvider() {
  return CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) {
        logger.warn("Auth credentials validation failed");
        return null;
      }

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({
        where: { email },
        include: { credential: true },
      });

      if (!user || !user.isActive) {
        logger.warn("Auth denied for inactive or missing user");
        return null;
      }
      if (!user.credential?.passwordHash) {
        logger.warn("Auth denied due to missing credential hash");
        return null;
      }

      const bcrypt = await import("bcryptjs");
      const ok = await bcrypt.compare(password, user.credential.passwordHash);
      if (!ok) {
        logger.warn("Auth denied due to invalid password");
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      };
    },
  });
}

function getOidcProvider(): OAuthConfig<Record<string, unknown>> {
  return {
    id: "oidc",
    name: "OIDC",
    type: "oauth",
    issuer: env.AUTH_OIDC_ISSUER,
    wellKnown: env.AUTH_OIDC_WELL_KNOWN,
    clientId: env.AUTH_OIDC_CLIENT_ID!,
    clientSecret: env.AUTH_OIDC_CLIENT_SECRET!,
    authorization: { params: { scope: "openid email profile" } },
    checks: ["pkce", "state"],
    profile(profile) {
      return {
        id: String(profile.sub ?? profile.id ?? ""),
        name: typeof profile.name === "string" ? profile.name : null,
        email: typeof profile.email === "string" ? profile.email : null,
      };
    },
  };
}

function resolveProviderType(provider: string) {
  if (provider === "credentials") return "DEVELOPMENT_CREDENTIALS" as const;
  if (provider === "google") return "GOOGLE" as const;
  if (provider === "email") return "EMAIL" as const;
  return "OIDC" as const;
}

function getProviders() {
  if (env.AUTH_PROVIDER_MODE === "development_credentials") {
    return [getCredentialsProvider()];
  }

  if (env.AUTH_PROVIDER_MODE === "email") {
    return [
      EmailProvider({
        server: env.AUTH_EMAIL_SERVER!,
        from: env.AUTH_EMAIL_FROM!,
      }),
    ];
  }

  if (env.AUTH_PROVIDER_MODE === "google") {
    return [
      GoogleProvider({
        clientId: env.AUTH_GOOGLE_CLIENT_ID!,
        clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET!,
      }),
    ];
  }

  return [getOidcProvider()];
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: getProviders(),
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) {
        logger.warn("Auth denied because provider did not return an email");
        return "/login?error=AUTH_EMAIL_REQUIRED";
      }

      const appUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          invitationStatus: true,
          _count: { select: { orgRoles: true, clinicRoles: true } },
        },
      });

      if (!appUser) {
        logger.warn("Auth denied: no platform user found for email");
        return "/login?error=ACCESS_PENDING";
      }

      if (appUser.invitationStatus === "REVOKED") {
        logger.warn("Auth denied: invite is revoked");
        return "/login?error=INVITE_REVOKED";
      }

      if (!appUser.isActive && appUser.invitationStatus !== "PENDING") {
        logger.warn("Auth denied: user is inactive");
        return "/login?error=ACCOUNT_INACTIVE";
      }

      if (appUser._count.orgRoles === 0 && appUser._count.clinicRoles === 0) {
        logger.warn("Auth denied: user has no workspace memberships");
        return "/login?error=NO_WORKSPACE_ACCESS";
      }

      const providerType = resolveProviderType(account?.provider ?? "oidc");
      await markUserAuthenticated({
        userId: appUser.id,
        providerType,
        providerAccountId: account?.providerAccountId,
      });

      const mutableUser = user as typeof user & { id: string; name: string; email: string };
      mutableUser.id = appUser.id;
      mutableUser.email = appUser.email;
      mutableUser.name = `${appUser.firstName} ${appUser.lastName}`.trim();

      logger.info("Auth sign-in success", { provider: account?.provider ?? "unknown" });
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const context = await buildSessionContext(user.id);
        if (!context) {
          logger.warn("Auth denied: unable to build session context");
          return token;
        }
        applyContextToToken(token, context);
      } else if (token.userId && !token.roleSummary) {
        const context = await buildSessionContext(token.userId as string);
        if (context) applyContextToToken(token, context);
      }
      return token;
    },
    async session({ session, token }) {
      return applyTokenToSession(session, token);
    },
  },
};

