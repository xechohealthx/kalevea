# Phase 2B.1 Document Hardening Closeout

## Scope

Small hardening pass on the Phase 2B document upload infrastructure.

## Changes Implemented

- Added category-to-mime policy enforcement in both:
  - `POST /api/documents/upload-url`
  - `POST /api/documents/finalize`
- Added optional SHA256 integrity verification:
  - client can send `checksumSha256`
  - upload URL can require `x-amz-meta-sha256`
  - finalize compares checksum against S3 object metadata
- Added stronger finalize integrity behavior:
  - missing object rejection
  - size mismatch rejection
  - mime mismatch rejection
  - checksum mismatch rejection
- Added orphan cleanup attempt on integrity mismatch (`DeleteObject`).
- Added safe security-oriented logging for:
  - invalid mime policy rejection
  - integrity mismatches
  - missing upload object during finalize

## Files Updated

- `server/services/storage/s3.service.ts`
- `server/services/documents/document.service.ts`
- `components/documents/add-document-dialog.tsx`
- `docs/document-storage.md`

## Schema Changes

- None. Existing document category field and metadata model were reused.

## Deferred Follow-ups

- stronger server-side file content sniffing (magic-byte validation)
- malware scanning / quarantine flow
- multipart upload + resumable retries for very large files
