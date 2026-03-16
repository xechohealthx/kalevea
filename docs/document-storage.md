# Document Storage Architecture (Phase 2B)

## Overview

Kalevea uses a two-step S3 pipeline for secure uploads:

1. Request signed upload URL
2. Finalize upload and persist metadata

This keeps binary transfer out of the app server while preserving tenancy checks and audit records.

## Route Flow

### `POST /api/documents/upload-url`

Input:

- `filename`
- `mimeType`
- `size`
- `organizationId` or `clinicId`
- `category`
- `title`
- optional `workflowParent`

Behavior:

- requires authenticated user
- validates org/clinic access
- validates mime type and size limits
- generates signed S3 PUT URL
- returns:
  - `uploadUrl`
  - `storageKey`
  - `maxSize`

### `POST /api/documents/finalize`

Input:

- `storageKey`
- `mimeType`
- `fileSize`
- `organizationId` or `clinicId`
- `category`
- `title`
- optional `workflowParent`

Behavior:

- verifies object exists via S3 `HeadObject`
- validates size + content type
- creates `Document` metadata record
- optionally attaches document to workflow parent
- writes audit records

### `GET /api/documents/[documentId]/download`

Behavior:

- checks tenant access
- returns short-lived signed GET URL
- does not expose raw S3 bucket paths

### `POST /api/documents/attach`

Behavior:

- links an existing document to a workflow parent using existing workflow primitive attachment model.

## Storage Key Format

Tenant-scoped object keys:

- org-scoped: `org/{orgId}/documents/{uuid}-{filename}`
- clinic-scoped: `org/{orgId}/clinic/{clinicId}/documents/{uuid}-{filename}`

## Security Rules

- tenant access validated before URL generation and finalization
- object key must match tenant namespace prefix
- category → mime policy enforced at upload URL and finalize stages
- size and mime type validated at finalize
- signed URLs are short-lived
- no AWS credentials or signed URLs logged
- no PHI included in logs or metadata

## Upload Validation and Integrity Controls

- **Category to MIME policy**:
  - `GENERAL` => PDF, PNG, JPG, TXT
  - `CONTRACT` => PDF
  - `ONBOARDING` => PDF, PNG, JPG
  - `TRAINING` => PDF
  - `COMPLIANCE` => PDF
  - `SUPPORT` => PDF, PNG, JPG
- **Optional checksum verification**:
  - client may provide `checksumSha256` at upload request/finalize
  - signed upload URL includes required `x-amz-meta-sha256` metadata header
  - finalize compares expected checksum to S3 object metadata
- **Integrity mismatch handling**:
  - missing object, size mismatch, mime mismatch, and checksum mismatch all reject finalize
  - finalize attempts safe orphan cleanup by deleting the uploaded object on integrity mismatch
  - errors are structured and avoid leaking storage internals

## Notes

- Uploads are direct-to-S3 from browser using signed PUT URL.
- Finalization is required before a document becomes visible in app metadata.
- Existing workflow primitive `FileAttachment` is reused; no new attachment model introduced.
