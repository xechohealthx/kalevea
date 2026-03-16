# Identity Admin (Phase 2A.1)

## Scope

Phase 2A.1 adds a minimal operational identity admin layer on top of Phase 2A auth hardening.
It is intentionally lightweight and organization-first.

## Invite Lifecycle

- `PENDING`
  - Created through invite API/UI.
  - User is inactive and can be activated on successful authenticated identity match.
- `ACCEPTED`
  - Set when the invited user successfully authenticates and is normalized into app identity.
  - `acceptedAt` is recorded.
- `REVOKED`
  - Invite revoked by admin action.
  - Prevents invite-path activation for that user.

## API Routes

- `GET /api/identity/members?organizationId=<id>`
  - Lists members + invites for the organization.
- `POST /api/identity/invites`
  - Creates a pending invite and role grants.
- `POST /api/identity/invites/[inviteId]/revoke`
  - Revokes a pending invite.
- `POST /api/identity/invites/[inviteId]/resend`
  - Stub action that refreshes `invitedAt` and logs/audits.

## Permission Model

Uses existing permission system with two new permissions:

- `identity.read`
- `identity.manage`

Invite/member admin actions are organization-scoped:

- list members/invites => `identity.read` on organization
- create/revoke/resend invite => `identity.manage` on organization

## Member List Response Shape

Each row includes safe operational identity fields:

- `userId`
- `name`
- `email`
- `invitationStatus`
- `authProviderType`
- `isActive`
- `organizationRoles[]`
- `clinicScopes[]`
- `invitedAt`
- `acceptedAt`

Excluded:

- tokens
- secrets
- passwords
- PHI

## Future Invite Delivery Flow

Current resend is a stub and does not send external mail yet.

Deferred work:

- signed invite token issuance
- transactional email integration
- invite acceptance deep link UX
