# Prior Authorization Engine Foundation (Phase 2C)

## Purpose

This module introduces the first reusable Prior Authorization (PA) domain layer in Kalevea. It is intentionally operational: it tracks authorization work across clinics without introducing EMR-style clinical charting.

## Domain Model

### `PriorAuthorizationCase`

- Tenant-scoped by `organizationId` and `clinicId`
- Operational context fields:
  - `payerName`
  - `medicationName`
  - `patientReferenceId` (external/system reference only)
- Lifecycle field:
  - `status` (`DRAFT`, `SUBMITTED`, `PENDING_PAYER`, `APPROVED`, `DENIED`, `CANCELLED`)
- Provenance:
  - `createdByUserId`
  - `createdAt`, `updatedAt`

### `PriorAuthorizationStatusEvent`

- Immutable status transition history per case
- Captures:
  - `fromStatus`
  - `toStatus`
  - `note`
  - `changedByUserId`
  - `createdAt`

This table gives PA-specific lifecycle history while workflow primitives continue to provide generic cross-module eventing.

## Permission and Tenancy Enforcement

- New permissions:
  - `priorAuth.read`
  - `priorAuth.manage`
- Service layer enforces clinic-scoped checks via `requirePermission(...)`
- Access is constrained to the actor's accessible clinics (or global role access)

## Service Layer

File: `server/services/prior-auth/prior-auth.service.ts`

- `createPACase()`
  - Creates a DRAFT case
  - Creates first `PriorAuthorizationStatusEvent`
  - Writes generic workflow `StatusEvent`
  - Optionally adds initial note
  - Optionally attaches existing documents
  - Writes audit log (`CREATE`, `PriorAuthorizationCase`)
- `updatePAStatus()`
  - Validates manage permission
  - Updates case status
  - Creates `PriorAuthorizationStatusEvent`
  - Writes workflow `StatusEvent`
  - Optionally attaches documents
  - Writes audit log (`UPDATE`, `PriorAuthorizationCase`)
- `listPACases()`
  - Returns tenant-scoped case list
  - Supports optional clinic/status filtering
- `getPACase()`
  - Returns case detail + status history + attachments + activity

## API Surface

- `GET /api/prior-auth/cases`
- `POST /api/prior-auth/cases`
- `GET /api/prior-auth/cases/[caseId]`
- `POST /api/prior-auth/cases/[caseId]/status`

All routes validate payloads with Zod and execute through centralized route error handling.

## Document Attachment Integration

PA cases reuse workflow primitive attachments:

- Parent type: `PRIOR_AUTH_CASE`
- Documents are attached via `attachDocumentToParent(...)`
- Keeps PA attachment design consistent with onboarding/support/REMS patterns

## Minimal UI Foundation

Page: `app/(dashboard)/prior-auth/page.tsx`

- List view for PA cases
- Filter by clinic
- Create case dialog
- Detail panel with status timeline
- Status update form

This is deliberately small and operational to avoid premature workflow complexity.

## Deferred for Future Phases

- Payer-specific rules engines
- Appeals/reconsideration workflows
- SLA queues and assignment orchestration
- Submission transport integrations (payer portals, clearinghouse rails)
- Rich artifact classification/templating for PA packages
