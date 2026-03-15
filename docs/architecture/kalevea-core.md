# Kalevea Core Architecture (Foundation)

Kalevea is a production-shaped, multi-tenant **operations platform** for a treatment-network MSO. It is **not an EMR**. It is the operating system around the EMR for clinic onboarding, provider/staff management, operational support, documents, training, and analytics.

This document describes the **Core Platform Foundation** and the extension points for future engines (PA, Buy & Bill, REMS, Claims, Inventory).

---

## Architecture overview

- **Frontend**: Next.js (TypeScript, App Router) + Tailwind CSS + shadcn-style UI primitives.
- **Backend**: Next.js route handlers (`app/api/*`) calling a modular **services layer** (`server/services/*`).
- **Data**: Prisma ORM + PostgreSQL.
- **Validation**: Zod for all mutation inputs at the service boundary.
- **State**: TanStack Query provider is wired for future client-side data workflows; most foundation pages are server-rendered for simplicity and security.

High-level flow:

1. UI invokes route handlers for mutations (create/update).
2. Route handler authenticates the user and parses input with Zod.
3. Service enforces tenancy + authorization, performs Prisma reads/writes.
4. Mutations write an **AuditLog** entry and may write workflow events.

---

## Tenancy model

Kalevea is multi-tenant in two dimensions:

- **Organization**: top-level tenant boundary (e.g., Kalevea MSO and future clinic organizations).
- **Clinic**: operational workspace under an organization; most domain objects are clinic-scoped.

Tenancy rules (Core):

- All clinic-scoped data is queryable by `clinicId`.
- All organization-scoped data is queryable by `organizationId`.
- Access is computed from the authenticated user’s role grants.

Implementation:

- `server/services/auth/auth.service.ts` produces an **access snapshot** (accessible orgs/clinics).
- Services scope reads/writes to those accessible IDs and reject out-of-scope access.

---

## RBAC model

RBAC uses **Role** records with explicit scope:

- `GLOBAL`: MSO-level roles (e.g., Super Admin, Executive)
- `ORGANIZATION`: roles scoped to an organization
- `CLINIC`: roles scoped to a clinic

Grants are modeled via:

- `UserOrganizationRole` (user + organization + role)
- `UserClinicRole` (user + clinic + role)

Legacy role guards (still supported):

- `lib/rbac/require.ts`
  - `requireGlobalRole(userId, roles)`
  - `requireOrganizationRole(userId, organizationId, roles)`
  - `requireClinicRole(userId, clinicId, roles)`

### Permissions layer (preferred for new code)

Kalevea introduces a **permissions layer** as the stable contract for authorization:

- Permission constants live in `lib/rbac/permissions.ts`
- Permission checks live in `lib/rbac/check.ts`
  - `getUserPermissionsForScope(...)`
  - `canAccessPermission(...)`
  - `requirePermission(...)`

New modules should enforce permissions in services (not in UI) and avoid branching on role keys.

---

## Data model (Core)

The schema is defined in `prisma/schema.prisma` and includes:

- **Tenancy**: `Organization`, `Clinic`
- **Identity**: `User`, `Role`, `UserOrganizationRole`, `UserClinicRole`
- **Provider/Staff**: `Provider`, `StaffProfile`
- **Onboarding**: `ClinicOnboardingProject`, `OnboardingTask`
- **Support**: `SupportTicket`, `SupportTicketComment`
- **Training**: `TrainingCourse`, `TrainingLesson`, `TrainingAssignment`
- **Documents**: `Document` (metadata layer; storage integration is an extension point)
- **Workflow primitives**: `Note`, `FileAttachment`, `ActivityEvent`, `WorkTask`, `StatusEvent` (cross-module)
- **Audit**: `AuditLog` (append-only)

Dev auth scaffold (replaceable later):

- `UserCredential` stores a password hash for local development only.

---

## Audit logging and safety

- Core mutations write `AuditLog` records via `server/services/audit/audit.service.ts`.
- **No PHI in logs**: audit metadata must remain operational (IDs, status transitions, categories, etc.).

---

## Extension points for future engines

The Core platform is designed so engines can be integrated as modules without rewriting the foundation.

Integration guidelines:

- Add engine services under `server/services/<engine>/...`
- Add engine data models with explicit `clinicId` and `organizationId` scoping where applicable
- Use workflow primitives for cross-module activity/tasks/notes and attachments
- Use Core `AuditLog` for cross-module traceability
- Avoid hardcoding therapy-specific logic in Core (keep Core domain-neutral)

# Kalevea Core Architecture (Foundation)

Kalevea is a production-shaped, multi-tenant **operations platform** for a treatment-network MSO. It is **not an EMR**. It is the operating system around the EMR for clinic onboarding, provider/staff management, operational support, documents, training, and analytics.

This document describes the **Core Platform Foundation** delivered in this phase and the extension points for future engines (PA, Buy & Bill, REMS, Claims, Inventory).

---

## Architecture overview

- **Frontend**: Next.js (TypeScript, App Router) + Tailwind CSS + shadcn-style UI primitives.
- **Backend**: Next.js route handlers (`app/api/*`) calling a modular **services layer** (`server/services/*`).
- **Data**: Prisma ORM + PostgreSQL.
- **Validation**: Zod for all mutation inputs at the service boundary.
- **State**: TanStack Query provider is wired for future client-side data workflows; most foundation pages are server-rendered for simplicity and security.

High-level flow:

1. UI invokes route handlers for mutations (create/update).
2. Route handler authenticates the user and parses input with Zod.
3. Service enforces tenancy + RBAC, performs Prisma writes/reads.
4. Mutations write an **AuditLog** entry.

---

## Tenancy model

Kalevea is multi-tenant in two dimensions:

- **Organization**: top-level tenant boundary (e.g., Kalevea MSO and future clinic organizations).
- **Clinic**: operational workspace under an organization; most domain objects are clinic-scoped.

Tenancy rules (Core):

- All clinic-scoped data is queryable by `clinicId`.
- All organization-scoped data is queryable by `organizationId`.
- Access is computed from the authenticated user’s role grants.

Implementation:

- `server/services/auth/auth.service.ts` produces an **access snapshot** (accessible orgs/clinics).
- Services scope reads/writes to those accessible IDs and reject out-of-scope access.

---

## RBAC model

RBAC uses **Role** records with explicit scope:

- `GLOBAL`: MSO-level roles (e.g., Super Admin, Executive)
- `ORGANIZATION`: roles scoped to an organization
- `CLINIC`: roles scoped to a clinic

Grants are modeled via:

- `UserOrganizationRole` (user + organization + role)
- `UserClinicRole` (user + clinic + role)

Reusable helpers:

- `lib/rbac/require.ts`
  - `requireGlobalRole(userId, roles)`
  - `requireOrganizationRole(userId, organizationId, roles)`
  - `requireClinicRole(userId, clinicId, roles)`

### Permissions layer (preferred for new code)

Kalevea introduces a **permissions layer** as the stable contract for authorization:

- Permission constants live in `lib/rbac/permissions.ts`
- Permission checks live in `lib/rbac/check.ts`
  - `getUserPermissionsForScope(...)`
  - `canAccessPermission(...)`
  - `requirePermission(...)`

New modules should enforce permissions in services (not in UI) and avoid branching on role keys.

---

## Data model (Core)

The Core schema is defined in `prisma/schema.prisma` and includes:

- **Tenancy**: `Organization`, `Clinic`
- **Identity**: `User`, `Role`, `UserOrganizationRole`, `UserClinicRole`
- **Provider/Staff**: `Provider`, `StaffProfile`
- **Onboarding**: `ClinicOnboardingProject`, `OnboardingTask`
- **Support**: `SupportTicket`, `SupportTicketComment`
- **Training**: `TrainingCourse`, `TrainingLesson`, `TrainingAssignment`
- **Documents**: `Document` (metadata layer; storage integration is an extension point)
- **Workflow primitives**: `Note`, `FileAttachment`, `ActivityEvent`, `WorkTask`, `StatusEvent` (cross-module)
- **Audit**: `AuditLog` (append-only)

Dev auth scaffold (replaceable later):

- `UserCredential` stores a password hash for local development only.

---

## Audit logging and safety

- Core mutations write `AuditLog` records via `server/services/audit/audit.service.ts`.
- **No PHI in logs**: audit metadata must remain operational (IDs, status transitions, categories, etc.).

---

## Extension points for future engines

The Core platform is designed so engines can be integrated as modules without rewriting the foundation.

Recommended module boundaries:

- **PA Engine**: PA workflows, payer rules, submission status, attachments (document metadata integration).
- **Buy & Bill Engine**: purchasing, charge capture, reimbursement visibility hooks, contract logic.
- **REMS Engine**: compliance tasks, attestations, training gating, audit events.
- **Claim Engine (ClaimSens-derived)**: reconciliation, underpayment detection, analytics/dashboards.
- **Inventory Engine (MedGuard-derived)**: append-only inventory events, NDC/lot traceability, controlled medication workflows.

Integration guidelines:

- Add engine services under `server/services/<engine>/...`
- Add engine data models with explicit `clinicId` and `organizationId` scoping
- Use workflow primitives for cross-module activity/tasks/notes and attachments
- Use Core `AuditLog` for cross-module traceability
- Avoid hardcoding therapy-specific logic in Core (keep Core domain-neutral)

