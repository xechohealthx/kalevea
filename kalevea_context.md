## Kalevea context (current foundation)

### Platform description

Kalevea is a production-grade **multi-tenant SaaS/PWA operations platform** for a treatment-network MSO.

Kalevea is **not an EMR**. It is the operational system around the EMR for:

- clinic onboarding
- provider and staff management
- support and communication
- training and education
- document management (metadata foundation)
- compliance workflows (starting with REMS MVP)
- auditability and future analytics/dashboards

Core constraints:

- **No PHI** stored or logged.
- Multi-tenant scoping must be explicit and enforceable.
- Future engines must plug in cleanly as modular services + Prisma models.

---

### Architecture

- **Next.js App Router** hosts both UI and API.
  - UI route groups: `app/(auth)` and `app/(dashboard)`
  - API route handlers: `app/api/*`
- **Services layer**: `server/services/*`
  - Zod-validated inputs at the route boundary
  - Tenancy + authorization enforced in services
  - Prisma access stays in services
- **Prisma + PostgreSQL**: `prisma/schema.prisma`
- **Audit logging**: `AuditLog` for core mutations
- **Workflow primitives (cross-module)**:
  - `Note`, `WorkTask`, `StatusEvent`, `ActivityEvent`, `FileAttachment`

Authorization layers:

- **Role guards (legacy)**: `lib/rbac/require.ts`
- **Permissions (preferred)**:
  - `lib/rbac/permissions.ts`
  - `lib/rbac/check.ts` (`requirePermission`, etc.)

---

### Modules

Core (already implemented):

- Dashboard shell
- Clinics + clinic workspace
- Onboarding projects + task board
- Providers + staff directory
- Support tickets + comments
- Training courses + assignments
- Documents metadata foundation
- Settings (org/roles visibility)
- Audit logging

Engines (modular, plug-in style):

- **REMS MVP (implemented)**: programs, enrollments, requirements, attestations, readiness views
- Deferred: PA engine, Buy & Bill engine, Claim engine (ClaimSens-derived), Inventory engine (MedGuard-derived), lead routing

---

### Stack

- Next.js 16 (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn-style primitives (Radix)
- NextAuth (dev credentials)
- Zod
- TanStack Query provider available
- Prisma ORM v7 + PostgreSQL (pg driver adapter)

---

### Current progress (high signal)

- **Permissions layer** added on top of existing role concepts.
- **Workflow primitives** added to Prisma + workflow service utilities:
  - `server/services/workflow/*`
- **REMS MVP engine** added:
  - Prisma models + enums
  - Services: `server/services/rems/*`
  - API: `app/api/rems/*`
  - UI: `/rems`, `/rems/clinics/[clinicId]`, `/rems/providers/[providerId]`
- **Seed data** updated to include an `Esketamine REMS` program and demo enrollments/requirements/attestations.

## Kalevea context (Core Foundation)

### Platform description

Kalevea is a production-grade **multi-tenant SaaS/PWA operations platform** for a treatment-network MSO (starting with Spravato service line operations, expanding to other advanced therapies).

Kalevea is **not an EMR**. It is the operating system around the EMR for:

- clinic onboarding
- provider + staff management
- operational support + communication
- document workflows (metadata foundation)
- training + education scaffolding
- auditability and future analytics/dashboards

Security posture for Core: **no PHI** stored or logged; audit metadata is operational only.

---

### Architecture

**Next.js App Router** hosts both UI and API:

- **UI**: `app/(auth)` and `app/(dashboard)` route groups
- **API**: `app/api/*` route handlers
- **Services layer**: `server/services/*` (domain modules)
- **Data access**: Prisma + PostgreSQL via `lib/db/prisma.ts`

High-level request flow:

1. User authenticates (dev credentials) → session established.
2. Protected routes enforced via `middleware.ts`.
3. UI calls API route handlers for mutations / data.
4. Route handler:
   - validates input with Zod
   - calls a domain service (`server/services/...`)
5. Service enforces:
   - **tenancy scoping** (org/clinic access)
   - **RBAC** role requirements where applicable
   - writes **AuditLog** entries for mutations

Tenancy model:

- **Organization** is top-level tenant boundary.
- **Clinic** is the operational workspace under an organization.
- Most core objects are **clinic-scoped** and queryable by `clinicId`.
- Organization-scoped data is queryable by `organizationId`.
- Access snapshot is computed per user (`server/services/auth/auth.service.ts`).

RBAC model:

- Role scopes: `GLOBAL`, `ORGANIZATION`, `CLINIC`
- Grants via `UserOrganizationRole` and `UserClinicRole`
- Reusable guards in `lib/rbac/require.ts`:
  - `requireGlobalRole(...)`
  - `requireOrganizationRole(...)`
  - `requireClinicRole(...)`

---

### Modules

#### In scope now (Core Platform Foundation)

- **Multi-tenant foundation** (Organization/Clinic)
- **Authentication + session** (dev credentials; replaceable later)
- **RBAC** (global/org/clinic roles + helpers)
- **Dashboard shell** (sidebar + header + module navigation)
- **Clinic directory + workspace** (`/clinics`, `/clinics/[id]`)
- **Clinic onboarding engine** (projects + tasks + board)
- **Provider & staff management** (clinic-scoped directories)
- **Support center / ticketing** (tickets + comments)
- **Training / education scaffolding** (courses + assignments)
- **Document management foundation** (server-side metadata layer; storageKey abstraction)
- **Audit logging** (for core mutations)
- **Modular services architecture** for future engines

#### Deferred engines (explicitly not built in Core)

- Full **PA engine**
- Full **Buy & Bill engine**
- Full **REMS engine**
- Full **Claim engine** (ClaimSens-derived)
- Full **Inventory engine** (MedGuard-derived)
- Patient portal, marketing CRM, clearinghouse integrations, advanced automations

Future-ready integration intent:

- Keep Core domain-neutral (avoid hardcoding Spravato everywhere)
- Engines plug in as new service modules + Prisma models with org/clinic scoping + audit logging

---

### Stack

- **Next.js 16** (App Router) + **TypeScript (strict)**
- **Tailwind CSS** (with shadcn-style component primitives)
- **shadcn-style UI primitives** (Button/Card/Badge/Table/Tabs/Dialog/Select/Sheet/Input/Textarea/Label)
- **NextAuth** (Credentials provider for dev)
- **TanStack Query** provider wired for future client-side data flows
- **Zod** for validation
- **Prisma ORM v7** + **PostgreSQL**
  - uses Postgres driver adapter: `@prisma/adapter-pg` + `pg`

---

### Current progress (implemented in this repo)

#### Data model + seed

- Prisma schema: `prisma/schema.prisma` with:
  - Organization, Clinic, User, Role, grants (org/clinic)
  - Provider, StaffProfile
  - ClinicOnboardingProject, OnboardingTask
  - SupportTicket, SupportTicketComment
  - TrainingCourse, TrainingLesson, TrainingAssignment
  - Document (metadata), AuditLog
  - UserCredential (dev-only auth scaffold)
- Seed script: `prisma/seed.ts` (roles + demo org/clinics/users + sample onboarding/support/training/documents)
- Prisma config: `prisma.config.ts` (DATABASE_URL + seed hook)

#### Auth / security

- Login page: `/login`
- Session + protected routes: `middleware.ts`
- NextAuth route: `app/api/auth/[...nextauth]/route.ts`

#### Services + API

- Domain services exist for:
  - clinics, onboarding, providers, support, training, documents, organizations, audit, auth snapshot
- API routes exist for:
  - `/api/clinics`
  - `/api/onboarding/tasks/[taskId]` (PATCH)
  - `/api/providers/providers`, `/api/providers/staff`
  - `/api/support/tickets`, `/api/support/tickets/[ticketId]`, `/api/support/tickets/[ticketId]/comments`
  - `/api/documents`

#### Frontend foundation pages

- `/dashboard` (core metrics shell)
- `/clinics` + `/clinics/[id]`
- `/onboarding` + `/onboarding/[projectId]`
- `/providers`
- `/support` + `/support/[ticketId]`
- `/training`
- `/documents`
- `/settings`

#### PWA basics

- `app/manifest.ts`
- `app/icon.tsx` (generated icon)

#### Documentation

- `docs/architecture/kalevea-core.md`
- `docs/product/kalevea-mvp-modules.md`

