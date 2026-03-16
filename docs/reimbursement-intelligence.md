# Reimbursement Intelligence Foundation (Phase 2E)

## Purpose

Phase 2E introduces a dedicated reimbursement visibility layer that tracks expected value, claim context, payment records, and simple variance at case level. This is an operational analytics foundation, not full ERA ingestion or adjudication automation.

## Domain Model

### `ReimbursementCase`
- Tenant-scoped (`organizationId`, `clinicId`)
- Optional links:
  - `buyAndBillCaseId`
  - `priorAuthorizationCaseId`
- Core fields:
  - `payerName`
  - `expectedAmount`
  - `expectedAllowedAmount` (optional)
  - `patientReferenceId` (operational reference only)
  - `status`

### `ClaimRecord`
- Claim tracking entry under a reimbursement case
- Includes:
  - external claim references
  - payer context
  - submitted timestamp
  - claim status
  - billed amount

### `PaymentRecord`
- Actual payment entry
- Supports:
  - multiple payments per reimbursement case
  - optional claim linkage
  - source typing (`MANUAL`, `ERA_IMPORTED`, `OTHER`)

### `ReimbursementStatusEvent`
- Status transition history for reimbursement cases
- Stores from/to state, actor, timestamp, and note

## Reimbursement Lifecycle

`EXPECTED` -> `CLAIM_DRAFT` -> `SUBMITTED` -> `PENDING_PAYMENT` -> `PARTIALLY_PAID` -> `PAID` -> `CLOSED`

Alternative states:
- `DENIED`
- `APPEAL_NEEDED`

This lifecycle is operational visibility only. It does not imply final adjudication certainty.

### Claim Record Statuses

- `DRAFT`
- `SUBMITTED`
- `ACCEPTED`
- `REJECTED`
- `PENDING`
- `PAID`
- `DENIED`

Claim statuses can influence reimbursement case status transitions in a lightweight way.

## Variance Rules

For each reimbursement case:

- `totalPaid = sum(paymentRecords.paidAmount)`
- `variance = totalPaid - expectedAmount`

Visibility behavior:
- if `totalPaid` is 0, case remains pre-payment lifecycle state
- if `0 < totalPaid < expectedAmount`, case can be `PARTIALLY_PAID`
- if `totalPaid >= expectedAmount`, case can transition to `PAID`

No underpayment classification tiers are applied yet; this is deferred to later analytics phases.

## Linkage to Buy-and-Bill and Prior Auth

`ReimbursementCase` can optionally reference:

- `BuyAndBillCase` (Phase 2D)
- `PriorAuthorizationCase` (Phase 2C)

The relation is intentionally loose:
- supports operational lineage
- avoids hard coupling between domains

## Service Layer

`server/services/reimbursement/reimbursement.service.ts` provides:

- `listReimbursementCases()`
- `getReimbursementCase()`
- `createReimbursementCase()`
- `updateReimbursementStatus()`
- `createClaimRecord()`
- `updateClaimRecordStatus()`
- `createPaymentRecord()`
- `calculateReimbursementVariance()`

Responsibilities:
- tenant scoping
- permission enforcement
- linkage validation
- status/event creation
- variance calculation
- audit-safe logging

## Attachment Reuse

Reimbursement flows reuse existing workflow attachment primitives with parent types:

- `REIMBURSEMENT_CASE`
- `REIMBURSEMENT_CLAIM`
- `REIMBURSEMENT_PAYMENT`

This supports payer correspondence and remittance-supporting documents without parallel file infrastructure.

## Future Evolution

### Phase 2F (planned)
- ERA/835 ingestion and reconciliation mapping into `PaymentRecord`/`ClaimRecord`
- automated matching workflows

### Phase 2G (planned)
- underpayment detection logic
- variance classification and network analytics
- cross-clinic reimbursement intelligence dashboards
