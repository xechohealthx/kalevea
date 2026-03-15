# REMS MVP (Engine 1) — Architecture & Scope

This document describes the first “engine module” added on top of Kalevea Core: **REMS**.

Kalevea remains **not an EMR**. REMS here is operational compliance scaffolding: enrollments, requirements, attestations, readiness visibility, and auditability.

---

## Why REMS first

- It validates **module plug-in architecture** (Prisma models + services + routes + UI) without introducing heavy external integrations.
- It exercises tenancy boundaries across:
  - org-level program templates
  - clinic-level enrollments
  - provider-level enrollments
  - attestations and readiness rollups

---

## Data model (MVP)

Models (see `prisma/schema.prisma`):

- `RemsProgram`: reusable definition (e.g., *Esketamine REMS*)
- `ClinicRemsEnrollment`: clinic enrollment and expirations
- `ProviderRemsEnrollment`: provider enrollment and expirations
- `RemsRequirement`: requirements (applies to clinic or provider; types include DOCUMENT/TRAINING/ATTESTATION/OTHER)
- `RemsAttestation`: operational attestations tied to program + clinic (+ optional provider, requirement, enrollment)

Key MVP principles:

- **Explicit scoping**: enrollments and attestations include `organizationId` and `clinicId`
- **No PHI**: seed data and logs remain operational
- **Auditability**: REMS mutations write `AuditLog` entries

---

## Authorization

REMS uses the **permissions layer** (preferred over direct role-key checks):

- `rems.read`
- `rems.manage`
- `rems.attest`

Enforcement happens in services via `requirePermission(...)`.

---

## Shared workflow primitives

REMS also writes to generic workflow primitives (cross-module):

- `ActivityEvent` (status changes, attestations)
- `StatusEvent` (status transitions)

These primitives are designed to be reused later by PA, Buy & Bill, Claims, Inventory, and onboarding/support enhancements.

---

## API surface (MVP)

Route handlers validate inputs with Zod and call services:

- `GET /api/rems/programs`
- `GET /api/rems/clinics/[clinicId]`
- `PATCH /api/rems/clinics/[clinicId]` (upsert enrollment)
- `GET /api/rems/providers/[providerId]`
- `PATCH /api/rems/providers/[providerId]` (upsert enrollment)
- `POST /api/rems/attestations` (create attestation)

---

## UI (MVP)

Pages:

- `/rems`: index summary + clinic readiness + expirations + provider snapshot
- `/rems/clinics/[clinicId]`: clinic enrollment + requirements + provider compliance + attestations/activity
- `/rems/providers/[providerId]`: provider enrollment + requirements + attestations/activity

The UI is intentionally “ops dashboard” style: functional controls and clean data tables, not a marketing surface.

---

## What’s intentionally deferred

- Automated REMS rules engines / dynamic requirement evaluation
- Document workflow automation beyond metadata + attachment primitives
- Training integrations beyond scaffolding
- PA automation, claims pipelines, inventory ledgering, clearinghouse integrations

# REMS MVP (Engine 1) — Architecture & Scope

This document describes the first “engine module” added on top of Kalevea Core: **REMS**.

Kalevea remains **not an EMR**. REMS here is operational compliance scaffolding: enrollments, requirements, attestations, readiness visibility, and auditability.

---

## Why REMS first

- It validates **module plug-in architecture** (Prisma models + services + routes + UI) without introducing heavy external integrations.
- It exercises tenancy boundaries across:
  - org-level program templates
  - clinic-level enrollments
  - provider-level enrollments
  - attestations and readiness rollups

---

## Data model (MVP)

Models (see `prisma/schema.prisma`):

- `RemsProgram`: reusable definition (e.g., *Esketamine REMS*)
- `ClinicRemsEnrollment`: clinic enrollment and expirations
- `ProviderRemsEnrollment`: provider enrollment and expirations
- `RemsRequirement`: requirements (applies to clinic or provider; types include DOCUMENT/TRAINING/ATTESTATION/OTHER)
- `RemsAttestation`: operational attestations tied to program + clinic (+ optional provider, requirement, enrollment)

Key MVP principles:

- **Explicit scoping**: enrollments and attestations include `organizationId` and `clinicId`
- **No PHI**: seed data and logs remain operational
- **Auditability**: REMS mutations write `AuditLog` entries

---

## Authorization

REMS uses the **permissions layer** (preferred over direct role-key checks):

- `rems.read`
- `rems.manage`
- `rems.attest`

Enforcement happens in services via `requirePermission(...)`.

---

## Shared workflow primitives

REMS also writes to generic workflow primitives (cross-module):

- `ActivityEvent` (status changes, attestations)
- `StatusEvent` (status transitions)

These primitives are designed to be reused later by PA, Buy & Bill, Claims, Inventory, and onboarding/support enhancements.

---

## API surface (MVP)

Route handlers validate inputs with Zod and call services:

- `GET /api/rems/programs`
- `GET /api/rems/clinics/[clinicId]`
- `PATCH /api/rems/clinics/[clinicId]` (upsert enrollment)
- `GET /api/rems/providers/[providerId]`
- `PATCH /api/rems/providers/[providerId]` (upsert enrollment)
- `POST /api/rems/attestations` (create attestation)

---

## UI (MVP)

Pages:

- `/rems`: index summary + clinic readiness table
- `/rems/clinics/[clinicId]`: clinic enrollment + requirements + provider compliance + attestations/activity
- `/rems/providers/[providerId]`: provider enrollment + requirements + attestations/activity

The UI is intentionally “ops dashboard” style: functional controls and clean data tables, not a marketing surface.

---

## What’s intentionally deferred

- Automated REMS rules engines / dynamic requirement evaluation
- Document workflow automation beyond metadata + attachment primitives
- Training integrations beyond scaffolding
- PA automation, claims pipelines, inventory ledgering, clearinghouse integrations

