# Phase 2D Closeout: Buy-and-Bill Engine Foundation

## Completed

- Added buy-and-bill Prisma domain models:
  - `MedicationCatalogItem`
  - `MedicationLot`
  - `BuyAndBillCase`
  - `MedicationAdministrationEvent`
  - `BuyAndBillStatusEvent`
- Added `BuyAndBillCaseStatus` lifecycle enum.
- Added optional relation from buy-and-bill cases to `PriorAuthorizationCase`.
- Added service layer:
  - `listBuyAndBillCases`
  - `getBuyAndBillCase`
  - `createBuyAndBillCase`
  - `updateBuyAndBillStatus`
  - `recordMedicationAdministration`
  - `listMedicationLots`
  - `createMedicationLot`
- Added transaction-protected inventory decrement during administration.
- Added buy-and-bill API routes:
  - `GET/POST /api/buy-and-bill/cases`
  - `GET /api/buy-and-bill/cases/[caseId]`
  - `POST /api/buy-and-bill/cases/[caseId]/status`
  - `POST /api/buy-and-bill/cases/[caseId]/administrations`
  - `GET/POST /api/buy-and-bill/lots`
- Added minimal UI at `app/(dashboard)/buy-and-bill/page.tsx` with:
  - case list + create
  - lot list + create
  - case detail
  - status timeline
  - administration recording
- Added permission constants:
  - `buyAndBill.read`, `buyAndBill.manage`
  - `inventory.read`, `inventory.manage`
- Integrated nav/middleware route protection for buy-and-bill pages/APIs.
- Added demo seed data for medication catalog, lots, case, statuses, and administration.

## Validation and Safety

- Tenant scoping enforced at clinic/org boundaries.
- Permission guards enforced for read/manage inventory and buy-and-bill actions.
- Quantity checks prevent over-administration.
- Safe logging added for validation failures and critical mutations.
- Audit logs written for core mutations.

## Deferred Follow-Ups

- append-only inventory ledger events
- inventory reservation/hold flow
- administration reversal/correction path
- richer reimbursement/claims intelligence
- payer response ingestion and reconciliation automation
