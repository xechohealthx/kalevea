# Phase 2E Closeout: Reimbursement Intelligence Foundation

## What changed

- Added reimbursement intelligence domain models:
  - `ReimbursementCase`
  - `ClaimRecord`
  - `PaymentRecord`
  - `ReimbursementStatusEvent`
- Added enums:
  - `ReimbursementCaseStatus`
  - `ClaimRecordStatus`
  - `PaymentSourceType`
- Added optional linkage from reimbursement case to:
  - `BuyAndBillCase`
  - `PriorAuthorizationCase`
- Added service layer:
  - list/get/create reimbursement cases
  - reimbursement status updates
  - claim record create/status update
  - payment record create
  - expected vs paid variance calculation
- Added reimbursement API routes.
- Added reimbursement UI page with:
  - summary cards (expected/paid/variance/pending payment count)
  - case list and filter
  - create case
  - create claim
  - record payment
  - status timeline
- Added reimbursement/claims permissions and role mappings.
- Added seed data for one reimbursement case, claim, payment, and status events.
- Added consolidated foundation backlog:
  - `docs/foundation-todo-backlog.md`

## Routes added

- `GET /api/reimbursement/cases`
- `POST /api/reimbursement/cases`
- `GET /api/reimbursement/cases/[caseId]`
- `POST /api/reimbursement/cases/[caseId]/status`
- `POST /api/reimbursement/cases/[caseId]/claims`
- `POST /api/reimbursement/cases/[caseId]/payments`
- `POST /api/reimbursement/claims/[claimId]/status`

## Permissions added

- `reimbursement.read`
- `reimbursement.manage`
- `claims.read`
- `claims.manage`

## Schema changes

- New reimbursement models + enums for case/claim/payment/status history.
- Added relation fields on Organization, Clinic, User, BuyAndBillCase, and PriorAuthorizationCase to support reimbursement linking and actor tracking.

## Deferred follow-ups

### Phase 2F
- ERA/835 ingestion
- reconciliation matching workflow
- imported payment normalization with robust provenance

### Phase 2G
- underpayment detection heuristics and categorization
- network-level analytics and benchmarking
- advanced variance intelligence and trend surfaces
