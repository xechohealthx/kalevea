# Reimbursement Analytics Foundation

## Purpose

Phase 2G adds Kalevea's first network-level financial intelligence layer on top of reimbursement and ERA foundations.

The focus is practical operational analytics, not a full BI stack:

- case-level variance visibility
- underpayment detection
- payer and clinic rollups
- network summary metrics

## Inputs and Data Sources

Analytics are computed from existing domain objects:

- `ReimbursementCase` (`expectedAmount`, `expectedAllowedAmount`, `payerName`, `clinicId`)
- `ClaimRecord` (claim context/status)
- `PaymentRecord` (`paidAmount`, source and timing)
- `RemittanceFile` and `RemittancePayment` (via Phase 2F ingestion/reconciliation)

## Variance Logic

Implemented in `server/services/reimbursement/variance.service.ts`.

- **Core formula:** `varianceAmount = totalPaid - expectedAmount`
- **Percent variance:** `(varianceAmount / expectedAmount) * 100` when expected > 0
- **Underpayment baseline:** `expectedAllowedAmount` when present, otherwise `expectedAmount`

### Case-level output

- `expectedAmount`
- `expectedAllowedAmount`
- `totalPaid`
- `varianceAmount`
- `variancePercentage`
- `underpaymentFlag`

## Underpayment Detection Rules

Current deterministic rule set (no ML/payer heuristics in this phase):

1. underpaid when `totalPaid < expectedAmount`
2. if `expectedAllowedAmount` exists, underpaid when `totalPaid < expectedAllowedAmount`

`ReimbursementCase.underpaymentFlag` is persisted and updated as payments are recorded/reconciled.

## Aggregation Design

Implemented in `server/services/analytics/reimbursement-analytics.service.ts`.

### Network summary

- total cases
- total expected
- total paid
- total variance
- underpaid case count
- average payment variance
- underpayment rate

### Clinic summary

- grouped by clinic
- total cases/expected/paid/variance
- underpaid case count
- average variance per case

### Payer summary

- grouped by payer name
- total claims/expected/paid/variance
- underpaid case count
- underpayment rate
- average variance

### Underpaid case list

Operational case list for follow-up, with clinic, payer, expected, paid, and variance context.

## Snapshot Model

`PayerAnalyticsSnapshot` enables snapshot persistence:

- `organizationId`
- `payerName`
- totals and variance
- `underpaymentRate`
- `createdAt`

This allows trend tracking without requiring only real-time heavy queries.

## API Surface

- `GET /api/analytics/reimbursement/network`
- `GET /api/analytics/reimbursement/clinics`
- `GET /api/analytics/reimbursement/payers`
- `GET /api/analytics/reimbursement/underpayments`

## Security and Scope

- authenticated routes only
- tenant scope enforced through existing access model
- analytics permission checks (`analytics.read`)
- no PHI introduced in analytics payloads or logs

## Deferred

- statistical confidence and payer contract-aware expected baselines
- underpayment reason classification
- longitudinal trend dashboards and benchmarking packs
- alerting workflows for high-risk underpayment cohorts
