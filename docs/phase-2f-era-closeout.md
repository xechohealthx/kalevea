# Phase 2F Closeout: ERA / 835 Ingestion + Reconciliation

## What Changed

- Added ERA document category support (`ERA_REMITTANCE`) to the document pipeline.
- Added minimal remittance domain models:
  - `RemittanceFile`
  - `RemittancePayment`
  - `ReconciliationStatus` enum
- Added ERA parser service for foundational ANSI X12 835 extraction.
- Added reconciliation service to map remittance payments to `ClaimRecord` rows and create `PaymentRecord` entries.
- Added clinic-scoped ERA API routes and a minimal `/era` dashboard surface.
- Added permissions:
  - `era.read`
  - `era.manage`

## Routes Added

- `POST /api/era/upload`
- `POST /api/era/process`
- `GET /api/era/files`
- `GET /api/era/files/[fileId]`

## Files Added

- `app/(dashboard)/era/page.tsx`
- `app/api/era/upload/route.ts`
- `app/api/era/process/route.ts`
- `app/api/era/files/route.ts`
- `app/api/era/files/[fileId]/route.ts`
- `components/era/era-upload-form.tsx`
- `server/services/era/era-parser.service.ts`
- `server/services/era/era.schemas.ts`
- `server/services/era/era.service.ts`
- `server/services/reimbursement/reconciliation.service.ts`
- `docs/era-ingestion.md`
- `docs/phase-2f-era-closeout.md`

## Files Updated (Key)

- `prisma/schema.prisma`
- `server/services/documents/document.service.ts`
- `server/services/storage/s3.service.ts`
- `lib/rbac/permissions.ts`
- `lib/rbac/check.ts`
- `components/layout/nav.tsx`
- `middleware.ts`
- `components/documents/add-document-dialog.tsx`
- `app/(dashboard)/documents/page.tsx`

## Schema Notes

- Added `DocumentCategory.ERA_REMITTANCE`.
- Added remittance persistence models with reconciliation linkage to reimbursement artifacts.
- Preserved existing tenancy and reimbursement structures; no domain redesign.

## Deferred Follow-Ups

- Full 835 parser breadth (multiple loops, expanded qualifiers, robust partner-specific variants)
- Manual reconciliation UX and override actions
- Duplicate ERA ingestion controls and idempotency keys
- Automated exception queue for unmatched lines
- Phase 2G underpayment detection + network analytics
