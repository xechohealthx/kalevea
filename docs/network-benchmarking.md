# Network Benchmarking (Phase 3B)

## Purpose

Phase 3B introduces organization-scoped comparative benchmarking across clinics and payers. It provides operational intelligence without introducing a warehouse or BI stack.

## Audit Summary of Analytics Inputs

### PriorAuthorizationCase
- usable fields: `organizationId`, `clinicId`, `payerName`, `status`
- supports: approval/denial rates by clinic and payer

### ReimbursementCase
- usable fields: `organizationId`, `clinicId`, `payerName`, `expectedAmount`, `expectedAllowedAmount`, `underpaymentFlag`, `createdAt`
- supports: expected/paid variance, underpayment rate, treatment-level rollups

### PaymentRecord
- usable fields: `organizationId`, `clinicId`, `reimbursementCaseId`, `paidAmount`, `paidDate`
- supports: total paid and payment timeline calculations

### ClaimRecord
- usable fields: `organizationId`, `clinicId`, `payerName`, `status`, `submittedAt`
- supports: claim context and payer mix enrichment

### RemittancePayment
- usable fields: `paidAmount`, `adjustmentAmount`, `reconciliationStatus`, matched reimbursement links + remittance payer/clinic context
- supports: payer remittance rollups and reconciliation-aware benchmarking context

## Aggregation Service

Implemented in `server/services/analytics/network-benchmark.service.ts`.

Functions:

- `getClinicBenchmarkSummary()`
- `getPayerBenchmarkSummary()`
- `getAuthorizationBenchmarkSummary()`
- `getPaymentTimelineBenchmark()`

All functions:

- enforce organization-scoped access
- require `benchmarking.read`
- restrict to clinics user can access within target organization

## Metric Definitions

- **avg reimbursement per treatment**: total paid / reimbursement case count (per clinic)
- **avg days to payment**: days between `ReimbursementCase.createdAt` and first `PaymentRecord.paidDate`
- **PA approval rate**: approved / (approved + denied)
- **underpayment rate**: cases with `underpaymentFlag` / total cases
- **payer mix**: share of reimbursement cases per payer by clinic
- **payment timeline benchmarks**:
  - average days
  - median days (P50)
  - P90 days
  - paid-within-30-days rate

## API Surface

- `GET /api/analytics/network/clinics`
- `GET /api/analytics/network/payers`
- `GET /api/analytics/network/authorization`
- `GET /api/analytics/network/payment-timelines`

## UI Surface

- `app/(dashboard)/analytics/network/page.tsx`
  - clinic comparison table
  - payer comparison table
  - PA approval rate panel
  - payment timeline panel

## Security + Data Handling

- no PHI added to benchmark payloads
- organization-scope is mandatory
- query events logged via existing logger

## Snapshot Model Decision

`NetworkBenchmarkSnapshot` is not added in this phase because current aggregation complexity remains acceptable for foundation scale. This remains a deferred optimization path for later scheduled benchmark materialization.
