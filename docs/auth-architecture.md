# Kalevea Auth Architecture (Phase 2A)

## Overview

Kalevea uses NextAuth for authentication and keeps authorization in existing tenancy + RBAC/permission services.
Phase 2A hardens identity by separating:

- provider configuration
- sign-in eligibility checks
- session shaping
- internal actor hydration for server code

## Auth Modes by Environment

Auth behavior is controlled by `AUTH_PROVIDER_MODE`:

- `development_credentials`
  - Intended for local development only.
  - Uses seeded credential login.
  - Blocked outside development by env validation.
- `email`
  - Uses NextAuth Email provider.
  - Requires `AUTH_EMAIL_SERVER` and `AUTH_EMAIL_FROM`.
- `google`
  - Uses NextAuth Google provider.
  - Requires `AUTH_GOOGLE_CLIENT_ID` and `AUTH_GOOGLE_CLIENT_SECRET`.
- `oidc`
  - Uses a generic OIDC OAuth provider config.
  - Requires `AUTH_OIDC_CLIENT_ID`, `AUTH_OIDC_CLIENT_SECRET`, and either `AUTH_OIDC_ISSUER` or `AUTH_OIDC_WELL_KNOWN`.

## Session Structure

The session payload is intentionally minimal:

- `user.id`
- `user.name`
- `user.email`
- `user.activeOrganizationId`
- `user.activeClinicId` (nullable)
- `user.roleSummary`:
  - `globalRoles`
  - `organizationRoleCount`
  - `clinicRoleCount`

No secrets, provider tokens, or PHI are added to session state.

## Identity + Membership Mapping

Centralized files:

- `lib/auth/auth-options.ts` - provider mode selection, sign-in checks, callbacks
- `lib/auth/session.ts` - token/session mapping utilities
- `lib/auth/identity.ts` - membership hydration and role summary derivation
- `lib/auth/current-user.ts` - server-side actor guards

Sign-in flow:

1. External provider authenticates identity.
2. Kalevea resolves local `User` by email.
3. Sign-in is denied if:
   - no local user
   - inactive user (non-invite-pending)
   - no org/clinic memberships
4. If invite-pending, user metadata is normalized as accepted on successful auth.
5. Session context is hydrated from Kalevea membership/access data.

## Route Protection Model

- `middleware.ts` handles baseline authenticated route gating.
- API handlers use shared guards (`requireAuthenticatedUserId`) instead of ad-hoc checks.
- Service-layer permission checks remain authoritative via existing `requirePermission(...)`.

## Invite-Ready Foundation

`server/services/auth/invite.service.ts` adds backend primitives to:

- create pending invite users tied to org/clinic scope + role
- assign membership grants at invite time
- mark pending invites as accepted

This is backend readiness only; UI/email invite flow remains a future step.

## Future Path: Enterprise SSO/OIDC

Phase 2A keeps scope to production-safe auth foundations.
Follow-on enterprise work can layer:

- full IdP metadata management UI
- SCIM/JIT provisioning rules
- domain-based invite policies
- SSO enforcement and session policy controls
