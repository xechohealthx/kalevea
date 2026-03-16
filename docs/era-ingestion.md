# ERA / 835 Ingestion Foundation

## Scope

Phase 2F introduces a foundational ERA ingestion pipeline that:

- uploads ERA/835 files through the existing S3 document pipeline
- parses key 835 remittance fields
- stores remittance file/payment rows
- reconciles parsed payments against existing `ClaimRecord` and `ReimbursementCase` rows
- creates `PaymentRecord` entries from matched remittance lines

This is intentionally not a full clearinghouse or full RCM subsystem.

## Ingestion Flow

1. Client requests upload URL via `POST /api/era/upload`.
2. Server validates tenancy/permissions and returns a signed PUT URL.
3. Client uploads file directly to S3.
4. Client calls `POST /api/era/process`.
5. Server finalizes the document record as `ERA_REMITTANCE`, reads S3 object text, parses 835 content, persists remittance records, and runs reconciliation.

## Domain Models

### `RemittanceFile`

- tenancy: `organizationId`, `clinicId`
- source document: `documentId`
- parsed metadata: `payerName`, `paymentDate`, `totalAmount`
- reconciliation rollup: `reconciliationStatus` (`UNMATCHED`, `PARTIALLY_MATCHED`, `MATCHED`)

### `RemittancePayment`

- parent: `remittanceFileId`
- matching keys: `claimReference`, `payerClaimControlNumber`
- amounts: `paidAmount`, `adjustmentAmount`
- parsed metadata: `cacCodes`, `renderingNpi`, `billingTaxId`
- reconciliation link fields:
  - `matchedClaimRecordId`
  - `matchedReimbursementCaseId`
  - `paymentRecordId`

## Parser Notes

`server/services/era/era-parser.service.ts` performs a minimal, structured parse:

- identifies 835 transaction (`ST*835`)
- extracts payer from `N1*PR`
- extracts payment total/date from `BPR`
- extracts tax/NPI-style identifiers from `REF` qualifiers
- extracts claim payment rows from `CLP`
- extracts adjustment reason codes/amounts from `CAS`

The parser is deliberately conservative and ready for incremental expansion in later phases.

## Reconciliation Process

`server/services/reimbursement/reconciliation.service.ts`:

1. finds candidate `ClaimRecord` using `claimNumber` or `externalClaimId`
2. creates `PaymentRecord` with `sourceType = ERA_IMPORTED`
3. links remittance payment to claim/reimbursement/payment rows
4. updates claim status (`PAID` when billed amount is fully covered, otherwise `PENDING`)
5. updates file-level reconciliation status

## Security + Tenancy

- routes require authenticated users
- all actions enforce clinic-scoped permission checks (`era.manage`, `era.read`)
- storage stays tenant namespaced under existing document key patterns
- no signed URLs or credentials are logged
- mutation events are captured through existing audit logging

## API Surface

- `POST /api/era/upload`
- `POST /api/era/process`
- `GET /api/era/files`
- `GET /api/era/files/[fileId]`

## Deferred (Future)

- robust loop-level parsing across all 835 variants
- confidence scoring and advanced fallback matching
- manual reconciliation queue/actions
- ERA idempotency and duplicate detection enhancements
- deeper denial and underpayment signal extraction for Phase 2G
