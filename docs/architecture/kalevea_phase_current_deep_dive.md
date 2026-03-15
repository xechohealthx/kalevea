# Kalevea — Current Phase Deep Dive (Core + Permissions + Workflow Primitives + REMS MVP)

This document is intended to “teach” a ChatGPT Project (or any engineer onboarding) **everything that is currently implemented** in the Kalevea repo for the current phase.

It covers:

- platform intent + non-goals
- repository structure
- technical architecture and request lifecycle
- tenancy model
- authentication + session security
- RBAC model (roles) **and** the new **permissions layer**
- data model (Prisma schema) including newly-added workflow primitives + REMS engine
- service layer boundaries and patterns
- API route handlers and validation
- audit logging and “no PHI” constraints
- UI pages and key components
- seed data and demo accounts
- how to extend safely (future engines)

> Kalevea is **not an EMR**. No PHI should be stored in Kalevea tables, seeds, or logs.

---

## 1) Platform intent (what Kalevea is)

Kalevea is a **multi-tenant operations platform** for a treatment-network MSO. It is the “operating system around the EMR” for operational workflows like:

- clinic onboarding
- provider + staff management
- operational support + ticketing
- training + education scaffolding
- operational document management (metadata foundation)
- compliance workflows (starting with **REMS MVP**)
- analytics/dashboards (foundation-level visibility; advanced analytics deferred)

Kalevea’s architecture is intentionally shaped so future “engines” (PA / Buy & Bill / Claims / Inventory / REMS) can plug in as modules without rewriting core.

---

## 2) Non-goals (explicitly deferred)

This repo intentionally does **not** implement in the current phase:

- a full Claims pipeline, clearinghouse integration, or automated reconciliation engine
- a full Prior Authorization automation engine
- a full inventory ledger / NDC-lot traceability engine (MedGuard-derived) in production shape
- patient portal / patient-facing features
- marketing CRM
- advanced automations rules engine
- PHI ingestion, storage, or logging

---

## 3) Stack and runtime topology

### 3.1 Frontend

- **Next.js 16** App Router
- **TypeScript** (strict)
- **Tailwind CSS** for layout and style
- **shadcn-style UI primitives** (Radix under the hood) in `components/ui/*`
- TanStack Query provider is wired (`app/providers.tsx`) for future client-driven workflows

### 3.2 Backend (inside the same Next.js app)

- **Route handlers** under `app/api/**/route.ts`
- Domain logic lives in a clean **services layer** under `server/services/**`
- Route handlers:
  - authenticate the caller
  - validate with **Zod**
  - call services
  - return JSON in a consistent shape (via `lib/utils/route.ts`)

### 3.3 Database and ORM

- PostgreSQL (local dev)
- Prisma ORM v7
- Prisma uses **pg driver adapter** (`@prisma/adapter-pg`) to satisfy Prisma v7 client requirements.

Prisma client is centralized in:

- `lib/db/prisma.ts`

This file:

- reads `DATABASE_URL`
- constructs a `PrismaPg` adapter
- creates a `PrismaClient({ adapter })`
- memoizes it on `globalThis` in dev to avoid multiple instances during hot reload

---

## 4) Repository structure (high-signal map)

Top-level:

- `app/`: Next.js routes (UI + API)
- `components/`: reusable React components
  - `components/ui/`: shadcn-style primitives (Button/Card/Badge/etc.)
  - module buckets (clinics/onboarding/providers/support/training/documents/rems/layout)
- `lib/`: cross-cutting libraries
  - `lib/auth/*`: NextAuth options + server session helper
  - `lib/db/*`: Prisma client
  - `lib/rbac/*`: role guards + permissions system
  - `lib/utils/*`: cn(), errors, route response helpers
- `server/`: services layer
  - `server/services/<domain>/*.ts`
- `prisma/`: schema + seed
  - `prisma/schema.prisma`
  - `prisma/seed.ts`
- `docs/`: architecture and product docs

---

## 5) Request lifecycle (UI → API → service → DB → audit)

### 5.1 Read requests (server components)

Many dashboard pages are server components that read directly via services and Prisma (still within server execution).

Key principle:

- **Tenancy and authorization are enforced in services**, not in the UI.

### 5.2 Mutation requests (client components → API route handlers)

Interactive UI components (dialogs, editors) call `fetch("/api/...")`.

Pattern:

1. API route handler obtains the caller session via `auth()` (NextAuth server helper).
2. Route handler Zod-parses request body and/or querystring.
3. Route handler calls a service function with `ServiceContext` (`{ actorUserId, organizationId?, clinicId? }`).
4. Service enforces:
   - tenancy: the actor can access this org/clinic
   - authorization: the actor has permission for this action
5. Service performs Prisma write(s).
6. Service writes an `AuditLog` entry for create/update/delete.
7. Service may also write workflow primitives (ActivityEvent / StatusEvent / Note / WorkTask).

Route error handling is standardized via `lib/utils/route.ts`:

- Zod errors → 400 with `{ error: { code: "VALIDATION_ERROR", ... } }`
- App errors → status + code + message

---

## 6) Tenancy model (Organization + Clinic)

### 6.1 Tenancy boundaries

- `Organization`: top-level tenant boundary
- `Clinic`: operational workspace under an organization

### 6.2 Access snapshot

Tenancy access is computed by:

- `server/services/auth/auth.service.ts`
  - `getAccessSnapshot(userId)`

It returns:

- `globalRoleKeys`
- `accessibleOrganizationIds`
- `accessibleClinicIds`
- `defaultOrganizationId`

This snapshot is used by services to scope list queries and enforce “out-of-scope” rejections.

Important behavior:

- If a user has any global role, they can access all clinics.
- Otherwise, org grants → clinics under those org(s).
- Otherwise, clinic grants only.

---

## 7) Authentication and sessions (dev scaffold)

### 7.1 NextAuth Credentials

Auth uses NextAuth credentials provider:

- `lib/auth/auth-options.ts`
- `app/api/auth/[...nextauth]/route.ts`

Credentials are validated by:

- parsing email/password with Zod
- loading `User` + `UserCredential`
- `bcryptjs.compare()` against `UserCredential.passwordHash`

Session strategy:

- JWT strategy; session is projected with `session.user.id`
- Type augmentation: `types/next-auth.d.ts`

### 7.2 Protected routes

Protected routes are enforced by:

- `middleware.ts`

Protected UI prefixes include:

- `/dashboard`, `/clinics`, `/onboarding`, `/providers`, `/support`, `/training`, `/documents`, `/rems`, `/settings`

Protected API prefixes include:

- `/api/clinics`, `/api/onboarding`, `/api/providers`, `/api/support`, `/api/training`, `/api/documents`, `/api/rems`

Unauthenticated access:

- API → JSON 401
- UI → redirect to `/login?next=...`

---

## 8) Authorization model

Kalevea currently implements **two layers**:

1. **Role guards** (legacy, still supported)
2. **Permissions layer** (preferred for new code and engines)

### 8.1 Roles (legacy RBAC)

Roles exist in Prisma as:

- `Role` with `scope` enum: `GLOBAL | ORGANIZATION | CLINIC`
- grants:
  - `UserOrganizationRole`
  - `UserClinicRole`

Legacy guard helpers:

- `lib/rbac/require.ts`
  - `requireGlobalRole(userId, roles)`
  - `requireOrganizationRole(userId, organizationId, roles)`
  - `requireClinicRole(userId, clinicId, roles)`

These are still used by some Core services (especially earlier ones).

### 8.2 Permissions layer (RBAC v2)

Permissions are the stable contract for “what a user can do.”

#### Files

- `lib/rbac/permissions.ts`
- `lib/rbac/check.ts`

#### Permission constants (currently defined)

Grouped by module:

- Clinics: `clinics.read`, `clinics.manage`
- Providers: `providers.read`, `providers.manage`
- Onboarding: `onboarding.read`, `onboarding.manage`
- Support: `support.read`, `support.manage`
- Training: `training.read`, `training.manage`
- Documents: `documents.read`, `documents.manage`
- REMS: `rems.read`, `rems.manage`, `rems.attest`

#### Role → permission mapping

`lib/rbac/check.ts` defines `rolePermissions: Record<RoleKey, Permission[]>`.

Examples:

- `SUPER_ADMIN`: all permissions
- `MSO_EXECUTIVE`: read-only across modules (including `rems.read`)
- `COMPLIANCE_SPECIALIST`: includes `rems.read`, `rems.manage`, `rems.attest`
- `CLINIC_ADMIN`: manage providers/training/documents/support and attest REMS
- `READ_ONLY`: read-only across modules including REMS read

#### Permission scopes

Permission checks support:

- `GLOBAL`
- `ORGANIZATION`
- `CLINIC`

The scope input is explicit in `requirePermission` / `canAccessPermission`.

#### Key permission functions

In `lib/rbac/check.ts`:

- `getUserPermissionsForScope(userId, { scope: ... })`
  - computes permission set from global roles and (depending on scope) org + clinic roles
- `canAccessPermission(userId, permission, scopeInput)`
  - checks that the user has tenant access to the org/clinic
  - checks permission exists in computed set
- `requirePermission(...)`
  - throws `AppError("Insufficient permission", "UNAUTHORIZED", 403)` with details

#### Important usage guidance (for future engines)

New modules should:

- define module permissions (or add to `Permissions.*`)
- enforce permissions in services
- keep UI “thin”
- avoid checking role keys directly

---

## 9) Error handling and response shapes

### 9.1 AppError

`lib/utils/errors.ts` defines:

- `AppError` with `code`, `status`, and optional `details`

### 9.2 Route helper

`lib/utils/route.ts` defines:

- `withRouteErrorHandling(async () => ...)`
  - wraps exceptions
  - Zod errors become 400 with flattened details
  - `AppError` becomes status + code + message

API JSON shape:

- success: `{ data: <payload> }`
- failure: `{ error: { code, message, details? } }`

---

## 10) Audit logging (no PHI)

Audit logs are stored in:

- Prisma model: `AuditLog`

Writer:

- `server/services/audit/audit.service.ts`
  - `writeAuditLog({ ctx, action, entityType, entityId, organizationId?, clinicId?, metadata? })`

Critical constraint:

- metadata must contain **operational details only** (ids, status, category, etc.)
- no PHI

Most mutations in newer services (workflow + rems) write AuditLog entries.

---

## 11) Data model deep dive (Prisma schema)

The schema is defined in `prisma/schema.prisma`.

### 11.1 Core tenancy + identity

- `Organization`
  - unique `slug`
  - `type`: `MSO | CLINIC_ORG`
  - relationships to clinics, documents, audit, workflow primitives, REMS objects
- `Clinic`
  - belongs to an organization
  - has status + clinicType
  - relationships to providers/staff/onboarding/support/training/documents/workflow/rems
- `User`
  - email + name fields + isActive
  - relationships to grants and “createdBy/updatedBy/assigned” references
- `UserCredential` (dev auth only)
- `Role`, `UserOrganizationRole`, `UserClinicRole`

### 11.2 Existing operational modules

- Providers/staff
  - `Provider`
  - `StaffProfile`
- Onboarding
  - `ClinicOnboardingProject`
  - `OnboardingTask`
- Support
  - `SupportTicket`
  - `SupportTicketComment`
- Training
  - `TrainingCourse`
  - `TrainingLesson`
  - `TrainingAssignment`
- Documents
  - `Document` (metadata; actual blob storage integration is deferred)

### 11.3 Shared workflow primitives (cross-module)

These models exist to avoid re-implementing “notes/tasks/activity/attachments/status history” in every module.

They use a safe polymorphic parent reference:

- `parentType: string`
- `parentId: string`

and are scoped by:

- `organizationId` (required)
- `clinicId` (nullable)

Models:

- `Note`
  - `body`
  - `createdById`
  - indexes: org, clinic, (parentType,parentId), createdAt

- `FileAttachment`
  - links a `Document` to a parent entity
  - fields: `documentId`, createdById

- `ActivityEvent`
  - activity stream row
  - fields: `type`, `title`, `description?`, `metadata Json?`, createdById?

- `WorkTask`
  - generic tasks (not onboarding tasks)
  - fields: status (`WorkTaskStatus`), optional priority (`WorkTaskPriority`), assignment, dueAt, completedAt

- `StatusEvent`
  - status transition history for any parent
  - fields: fromStatus?, toStatus, note?

Enums:

- `WorkTaskStatus`: TODO | IN_PROGRESS | BLOCKED | DONE
- `WorkTaskPriority`: LOW | MEDIUM | HIGH | URGENT

### 11.4 REMS engine models (MVP)

Engine models:

- `RemsProgram`
  - `key` unique, `name`, `description?`, `isActive`
- `ClinicRemsEnrollment`
  - explicit `organizationId`, `clinicId`, `remsProgramId`
  - `status: RemsEnrollmentStatus`
  - `enrolledAt?`, `expiresAt?`, `lastReviewedAt?`, `notes?`
  - `createdById?`, `updatedById?`
  - unique `(clinicId, remsProgramId)`
- `ProviderRemsEnrollment`
  - explicit `organizationId`, `clinicId`, `providerId`, `remsProgramId`
  - unique `(providerId, remsProgramId)`
- `RemsRequirement`
  - can be global template or org/clinic scoped via nullable `organizationId`, `clinicId`
  - `appliesToType: CLINIC|PROVIDER`
  - `requirementType: DOCUMENT|TRAINING|ATTESTATION|OTHER`
  - sorting + isRequired + isActive
- `RemsAttestation`
  - explicit `organizationId`, `clinicId`, `remsProgramId`
  - optional `providerId`, `remsRequirementId`
  - optional links to enrollment IDs
  - `attestedById`, `attestedAt`, notes?

Enums:

- `RemsEnrollmentStatus`: NOT_ENROLLED | PENDING | ENROLLED | SUSPENDED | EXPIRED
- `RemsAppliesToType`: CLINIC | PROVIDER
- `RemsRequirementType`: DOCUMENT | TRAINING | ATTESTATION | OTHER

---

## 12) Services layer deep dive

Services live under `server/services/*` and are the primary “application layer.”

Common properties:

- input validation is typically done in route handlers with Zod, but services also define schemas for reuse
- services enforce:
  - tenancy scoping
  - authorization (role guards or permissions)
  - audit logging for mutations

### 12.1 Core services (existing)

- `server/services/auth/auth.service.ts`
  - builds access snapshots used by the rest of the platform

- `server/services/audit/audit.service.ts`
  - writes AuditLog rows (no PHI)

- `server/services/clinics/clinic.service.ts`
  - list clinics (scoped)
  - create clinic (org admin role guard currently)
  - get clinic by id (scoped)

- `server/services/onboarding/onboarding.service.ts`
  - list projects (scoped)
  - get project detail with tasks
  - patch onboarding task status/assignee/dueDate

- `server/services/providers/provider.service.ts`
  - list providers/staff (scoped)
  - create provider/staff (scoped)

- `server/services/support/support.service.ts`
  - list tickets, create ticket
  - ticket detail + comment creation

- `server/services/training/training.service.ts`
  - list courses
  - list assignments (scoped)

- `server/services/documents/document.service.ts`
  - list documents (scoped)
  - create document metadata

### 12.2 Workflow primitives service (new, shared)

Files:

- `server/services/workflow/workflow.service.ts`
- `server/services/workflow/workflow.schemas.ts`
- `server/services/workflow/workflow.types.ts`

Key concepts:

- a `ParentRef` is:
  - `organizationId`
  - optional `clinicId`
  - `parentType`, `parentId`

Tenancy enforcement:

- `enforceTenant(ctx, parentRef)` uses `getAccessSnapshot` to ensure the actor can access the clinic or org.

Authorization enforcement:

- optionally pass a `permission` and `workflow.service` will call `requirePermission` at org/clinic scope depending on `clinicId`.

Exposed functions:

- `listNotesForParent(ctx, parentRef)`
- `createNote(ctx, input, { permission? })`
  - writes `Note`
  - writes `ActivityEvent` type `NOTE_CREATED`
  - writes `AuditLog` entityType `Note`

- `listTasksForParent(ctx, parentRef)`
- `createTask(ctx, input, { permission? })`
  - writes `WorkTask`
  - writes `ActivityEvent` type `TASK_CREATED`
  - writes `AuditLog` entityType `WorkTask`

- `updateTaskStatus(ctx, taskId, { status, note? }, { permission? })`
  - updates `WorkTask.status`
  - writes `StatusEvent` (fromStatus → toStatus)
  - writes `ActivityEvent` type `TASK_STATUS_UPDATED`
  - writes `AuditLog` entityType `WorkTask`

- `listActivityForParent(ctx, parentRef)`
- `createStatusEvent(ctx, { fromStatus?, toStatus, note? }, { permission? })`
  - writes `StatusEvent`
  - writes `ActivityEvent` type `STATUS_CHANGED`
  - writes `AuditLog` entityType `StatusEvent`

- `attachDocumentToParent(ctx, { documentId, parentRef }, { permission? })`
  - validates the document is accessible for the org/clinic scope
  - writes `FileAttachment`
  - writes `ActivityEvent` type `DOCUMENT_ATTACHED`
  - writes `AuditLog` entityType `FileAttachment`

### 12.3 REMS service (new engine module)

Files:

- `server/services/rems/rems.service.ts`
- `server/services/rems/rems.schemas.ts`
- `server/services/rems/rems.types.ts`

Permissions used:

- `rems.read` for visibility
- `rems.manage` for enrollment updates
- `rems.attest` for attestations

Capabilities:

- `listPrograms(ctx)`
  - lists active REMS programs

- `getRemsDashboard(ctx, { remsProgramId? })`
  - returns:
    - program
    - summary cards:
      - total requirements
      - attestable requirements
      - attested requirement counts (MVP)
      - expired enrollments
      - upcoming expirations within 30 days
    - clinic readiness rows
    - upcoming expirations list
    - provider compliance snapshot list

Important: MVP completion is currently derived primarily from **ATTESTATION** requirements and recorded `RemsAttestation` rows.

- `getClinicRemsOverview(ctx, clinicId, { remsProgramId? })`
  - returns clinic enrollment, requirements, readiness summary
  - returns provider compliance rows
  - returns last attestations and workflow activity (ActivityEvent) for enrollment parent

Requirement scoping behavior:

- requirements are loaded for the program with a scope filter allowing:
  - global templates (orgId null, clinicId null)
  - org templates (orgId = clinic org, clinicId null)
  - clinic overrides (orgId = clinic org, clinicId = clinic)
  - clinic-only templates (orgId null, clinicId = clinic)

- `upsertClinicEnrollment(ctx, clinicId, input)`
  - requires `rems.manage` at clinic scope
  - upserts ClinicRemsEnrollment
  - writes a workflow `StatusEvent` for parent `REMS_CLINIC_ENROLLMENT`
  - writes an AuditLog entry

- `upsertProviderEnrollment(ctx, providerId, input)`
  - resolves provider → clinic, requires `rems.manage` for that clinic
  - upserts ProviderRemsEnrollment
  - writes workflow status event + audit log

- `getProviderRemsOverview(ctx, providerId, { remsProgramId? })`
  - provider-level page data + attestations + activity

- `createAttestation(ctx, input)`
  - requires `rems.attest` at clinic scope
  - creates `RemsAttestation`
  - writes an `ActivityEvent` type `REMS_ATTESTED`
  - writes an `AuditLog`

Parent types (used with workflow primitives):

- `REMS_CLINIC_ENROLLMENT`
- `REMS_PROVIDER_ENROLLMENT`

---

## 13) API surface (current phase)

Route handlers (pattern: auth → zod → service → JSON):

### 13.1 REMS routes (new)

- `GET /api/rems/programs`
  - `app/api/rems/programs/route.ts`
  - lists active programs

- `GET /api/rems/clinics/[clinicId]`
  - returns clinic overview JSON (enrollment, requirements, provider rows, attestations, activity)

- `PATCH /api/rems/clinics/[clinicId]`
  - upserts clinic enrollment
  - body validated by `upsertEnrollmentSchema`

- `GET /api/rems/providers/[providerId]`
  - returns provider overview JSON

- `PATCH /api/rems/providers/[providerId]`
  - upserts provider enrollment

- `POST /api/rems/attestations`
  - creates an attestation
  - body validated by `createAttestationSchema`

### 13.2 Existing Core routes (already present)

Examples:

- `GET/POST /api/clinics`
- `PATCH /api/onboarding/tasks/[taskId]`
- `GET/POST /api/providers/providers`
- `GET/POST /api/providers/staff`
- support: `/api/support/tickets` etc.
- documents: `/api/documents`

---

## 14) UI pages (App Router)

### 14.1 Auth pages

- `/login`
  - `app/(auth)/login/page.tsx`
  - `app/(auth)/login/ui.tsx` (client form)

### 14.2 Dashboard shell

- `app/(dashboard)/layout.tsx` wraps the shell
- Sidebar navigation: `components/layout/nav.tsx`
- Header user menu: `components/layout/user-menu.tsx`

### 14.3 Core module pages

- `/dashboard`
- `/clinics` and `/clinics/[id]`
- `/onboarding` and `/onboarding/[projectId]`
- `/providers`
- `/support` and `/support/[ticketId]`
- `/training`
- `/documents`
- `/settings`

### 14.4 REMS pages (new)

Pages:

- `/rems`
  - summary cards
  - clinic readiness table
  - upcoming expirations (30d)
  - provider compliance snapshot

- `/rems/clinics/[clinicId]`
  - clinic enrollment summary + editor
  - requirements table
  - provider compliance table with deep links
  - attestation list
  - activity list

- `/rems/providers/[providerId]`
  - provider enrollment + editor
  - requirements + attestations + activity

Interactive components:

- `components/rems/enrollment-editor.tsx` (clinic enrollment editor)
- `components/rems/provider-enrollment-editor.tsx` (provider enrollment editor)
- `components/rems/attest-dialog.tsx` (record attestation)

UI design intent:

- “professional operations dashboard”
- high signal density
- minimal marketing visuals

---

## 15) Seed data (demo-safe)

Seed script:

- `prisma/seed.ts`

Important Prisma v7 detail:

- seed script constructs `PrismaClient({ adapter: new PrismaPg(...) })` and loads `.env` via `dotenv/config`.

Seeded data includes:

- organization: Kalevea MSO
- 3 clinics (primary care, psych, hospital outpatient)
- users:
  - superadmin / exec / implementation / support / billing / compliance
  - clinic admin / provider / read-only
- onboarding project + tasks
- providers + staff profile(s)
- support tickets with comments
- training courses + lessons + assignments
- documents metadata
- REMS MVP:
  - program `key=esketamine` (“Esketamine REMS”)
  - requirements (clinic + provider; including attestation and doc types)
  - enrollments (some expiring within 30 days)
  - attestations for readiness demo

Demo password:

- `password`

---

## 16) PWA scaffold

Basic manifest + icon exist:

- `app/manifest.ts`
- `app/icon.tsx`

This is a foundation; full offline strategy/service worker behavior is deferred.

---

## 17) “No PHI” safety rules (implementation implications)

### 17.1 Data model implications

- There are no patient tables.
- “Requirement / attestation / note” text is operational only.
- Avoid storing names/identifiers of patients anywhere.

### 17.2 Logging implications

- AuditLog metadata must never include PHI.
- Errors returned from services should not embed PHI in message/details.

---

## 18) How to extend safely (future modules/engines)

When adding a new engine:

1. Define permissions
   - add `engine.read`, `engine.manage`, etc. in `lib/rbac/permissions.ts`
   - map roles → permissions in `lib/rbac/check.ts` (or introduce new roles)

2. Add Prisma models
   - include explicit `organizationId` and `clinicId` where appropriate
   - index for: orgId, clinicId, parentType+parentId (if polymorphic), status, assignedTo, dueAt

3. Implement services
   - `server/services/<engine>/*`
   - enforce tenancy (`getAccessSnapshot`)
   - enforce `requirePermission`
   - write `AuditLog` for mutations
   - use workflow primitives for notes/tasks/activity/attachments/status history

4. Implement API routes
   - Zod validate inputs
   - call services
   - return consistent JSON

5. Implement UI
   - server components for primary rendering
   - small client components for interactivity
   - keep UI consistent with the existing shell

---

## 19) Operational runbook (local dev)

### 19.1 Environment

`.env` must include:

- `DATABASE_URL=postgresql://...`
- `NEXTAUTH_SECRET=...`

### 19.2 Setup

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

### 19.3 Quality gates

```bash
npm run typecheck
npm run lint
npm run build
```

---

## 20) File index (what exists “right now”)

### UI pages (`app/**/page.tsx`)

- `app/page.tsx` (redirects to login or dashboard)
- `app/(auth)/login/page.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/clinics/page.tsx`
- `app/(dashboard)/clinics/[id]/page.tsx`
- `app/(dashboard)/onboarding/page.tsx`
- `app/(dashboard)/onboarding/[projectId]/page.tsx`
- `app/(dashboard)/providers/page.tsx`
- `app/(dashboard)/support/page.tsx`
- `app/(dashboard)/support/[ticketId]/page.tsx`
- `app/(dashboard)/training/page.tsx`
- `app/(dashboard)/documents/page.tsx`
- `app/(dashboard)/settings/page.tsx`
- `app/(dashboard)/rems/page.tsx`
- `app/(dashboard)/rems/clinics/[clinicId]/page.tsx`
- `app/(dashboard)/rems/providers/[providerId]/page.tsx`

### API routes (`app/api/**/route.ts`)

- `app/api/auth/[...nextauth]/route.ts`
- `app/api/clinics/route.ts`
- `app/api/onboarding/tasks/[taskId]/route.ts`
- `app/api/providers/providers/route.ts`
- `app/api/providers/staff/route.ts`
- `app/api/support/tickets/route.ts`
- `app/api/support/tickets/[ticketId]/route.ts`
- `app/api/support/tickets/[ticketId]/comments/route.ts`
- `app/api/documents/route.ts`
- `app/api/rems/programs/route.ts`
- `app/api/rems/clinics/[clinicId]/route.ts`
- `app/api/rems/providers/[providerId]/route.ts`
- `app/api/rems/attestations/route.ts`

### Services (`server/services/**/*.ts`)

- core: auth, audit, clinics, onboarding, providers, support, training, documents, organizations
- shared workflow primitives: `server/services/workflow/*`
- REMS engine: `server/services/rems/*`

---

## 21) Known limitations (intentional)

- Permissions layer exists, but earlier Core services may still be role-guarded; new engines should use permissions.
- Workflow primitives exist but are not yet wired into all Core modules (support/onboarding/etc.)—they are added as a shared foundation for future use.
- REMS readiness calculations are MVP and primarily based on attestations; document/training requirement completion is an extension point.

