# Buy-and-Bill Engine Foundation (Phase 2D)

## Purpose

The Buy-and-Bill module introduces an operational foundation for medication acquisition, administration, and reimbursement-state tracking. It is intentionally scoped for platform infrastructure, not full claims/RCM processing.

## Domain Model

### `MedicationCatalogItem`
- Shared or organization-scoped medication catalog entries
- Supports operational coding context (`ndc`, `hcpcsCode`)
- Used by lots and cases

### `MedicationLot`
- Clinic-scoped acquired inventory
- Tracks:
  - `quantityReceived`
  - `quantityRemaining`
  - `lotNumber`
  - `expirationDate`
  - supplier/invoice references

### `BuyAndBillCase`
- Operational case record tied to clinic and medication
- Optional linkage to `PriorAuthorizationCase`
- Tracks expected payer/reimbursement metadata
- Lifecycle status drives workflow readiness and reimbursement staging

### `MedicationAdministrationEvent`
- Immutable administration entries linked to case + lot
- Captures administered units and actor/time
- Drives inventory decrement and administration history

### `BuyAndBillStatusEvent`
- Immutable status transition history per case
- Captures `fromStatus`, `toStatus`, `changedByUserId`, `changedAt`, `note`

## Lifecycle

`DRAFT` -> `READY_FOR_ADMINISTRATION` -> `ADMINISTERED` -> `BILLING_PENDING` -> `SUBMITTED` -> `PAID`

Terminal/divergent states:
- `DENIED`
- `CANCELLED`

Status transitions are written to:
- module-specific `BuyAndBillStatusEvent`
- shared workflow `StatusEvent` stream for cross-module consistency

## Relationship To Prior Auth

`BuyAndBillCase.priorAuthorizationCaseId` is optional and loosely coupled:
- supports handoff from PA module
- does not hard-couple workflows or enforce PA-state business rules at this phase

## Inventory Rules

Implemented protections:
- administration cannot exceed `quantityRemaining`
- lot and case must match tenant scope (`organizationId`, `clinicId`)
- lot medication must match case medication
- inventory decrement + administration write run in a single transaction
- race-safe decrement guard using conditional `updateMany(... quantityRemaining >= units ...)`

Current limitations (deferred):
- no FIFO lot selection strategy
- no reservation/hold subsystem
- no reverse/void administration flow
- no append-only stock ledger events yet (future MedGuard-derived phase)

## Document Attachments

Buy-and-bill records reuse existing workflow attachment primitives:
- case parent: `BUY_AND_BILL_CASE`
- lot parent: `MEDICATION_LOT`
- administration parent: `MEDICATION_ADMINISTRATION`

This supports invoice/procurement docs and payer correspondence without adding another attachment framework.

## Permissions

Added permissions:
- `buyAndBill.read`
- `buyAndBill.manage`
- `inventory.read`
- `inventory.manage`

Services enforce permissions at clinic scope and preserve existing RBAC model.

## Future Reimbursement Intelligence

Deferred roadmap targets:
- charge submission packeting
- payer response normalization
- denial reason modeling and work queues
- reconciliation signals (expected vs paid deltas)
- ClaimSens-style variance detection integration
