# Phase 2A.1 Invite Closeout

## What Changed

- Added organization-scoped identity admin permissions (`identity.read`, `identity.manage`).
- Expanded invite service with lifecycle operations:
  - `listMembersAndInvites`
  - `createInvite`
  - `revokeInvite`
  - `resendInvite` (stub)
- Added identity admin APIs under `/api/identity`.
- Added minimal UI stub at `/settings/identity` for list/create/revoke/resend.
- Added invite lifecycle docs and route docs.

## Routes Added

- `GET /api/identity/members`
- `POST /api/identity/invites`
- `POST /api/identity/invites/[inviteId]/revoke`
- `POST /api/identity/invites/[inviteId]/resend`

## Files Added

- `app/api/identity/members/route.ts`
- `app/api/identity/invites/route.ts`
- `app/api/identity/invites/[inviteId]/revoke/route.ts`
- `app/api/identity/invites/[inviteId]/resend/route.ts`
- `app/(dashboard)/settings/identity/page.tsx`
- `components/settings/identity-admin-panel.tsx`
- `docs/identity-admin.md`
- `docs/phase-2a1-invite-closeout.md`

## Files Updated

- `server/services/auth/invite.service.ts`
- `lib/rbac/permissions.ts`
- `lib/rbac/check.ts`
- `lib/auth/auth-options.ts`
- `app/(auth)/login/ui.tsx`
- `app/(dashboard)/settings/page.tsx`
- `middleware.ts`

## Schema Changes

- No additional schema changes were required in this sprint.
- Existing invite/auth fields introduced in Phase 2A were reused.

## Deferred Follow-Ups

- signed invite tokens + email delivery
- richer member role editing UX
- bulk invite operations
- org-level identity analytics and security event review UI
