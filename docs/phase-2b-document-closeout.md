# Phase 2B Document Closeout

## What Changed

- Added S3 storage service wrapper for signed upload/download URLs and object verification.
- Implemented two-step upload pipeline:
  - request upload URL
  - finalize and persist metadata
- Added signed download endpoint.
- Added workflow attachment endpoint for linking uploaded docs to parent entities.
- Updated document upload UI to perform direct S3 upload + finalize flow.

## Routes Added

- `POST /api/documents/upload-url`
- `POST /api/documents/finalize`
- `GET /api/documents/[documentId]/download`
- `POST /api/documents/attach`

## Services Added

- `server/services/storage/s3.service.ts`
  - `createSignedUploadUrl`
  - `createSignedDownloadUrl`
  - `verifyObjectExists`

## Services Updated

- `server/services/documents/document.service.ts`
  - upload request schema/logic
  - finalize schema/logic
  - tenant-scoped key enforcement
  - signed download logic
  - workflow attachment helper

## UI Changes

- `components/documents/add-document-dialog.tsx`
  - now uploads file directly to S3 and finalizes metadata.
- `components/documents/download-button.tsx`
  - minimal signed download trigger.
- `app/(dashboard)/documents/page.tsx`
  - wired download action per row.

## Schema Changes

- No Prisma schema changes required for Phase 2B.
- Existing `Document` + `FileAttachment` models were sufficient.

## Deferred Follow-ups

- upload progress + retry UX
- virus scanning/quarantine flow
- stricter allowlist per document category
- multipart upload for larger files
- signed invite/token-linked upload workflows for external participants
