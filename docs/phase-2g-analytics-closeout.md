# Phase 2G Closeout: Underpayment Detection + Network Analytics

## What Changed

- Added a dedicated variance layer for case/clinic/payer calculations.
- Added deterministic underpayment detection and persisted case flagging.
- Added reimbursement analytics service with network, clinic, payer, and underpaid-case outputs.
- Added analytics API routes and minimal analytics dashboard page.
- Added analytics permissions and role mappings.
- Added lightweight payer snapshot model for future trend tracking.

## Files Added

- `server/services/reimbursement/variance.service.ts`
- `server/services/analytics/reimbursement-analytics.service.ts`
- `app/api/analytics/reimbursement/network/route.ts`
- `app/api/analytics/reimbursement/clinics/route.ts`
- `app/api/analytics/reimbursement/payers/route.ts`
- `app/api/analytics/reimbursement/underpayments/route.ts`
- `app/(dashboard)/analytics/reimbursement/page.tsx`
- `docs/reimbursement-analytics.md`
- `docs/phase-2g-analytics-closeout.md`

## Files Updated (Key)

- `prisma/schema.prisma`
- `server/services/reimbursement/reimbursement.service.ts`
- `lib/rbac/permissions.ts`
- `lib/rbac/check.ts`
- `components/layout/nav.tsx`
- `middleware.ts`

## Schema Updates

- `ReimbursementCase.underpaymentFlag` (Boolean, indexed)
- `PayerAnalyticsSnapshot` model
- Added organization relation for snapshot rows

## Routes Added

- `GET /api/analytics/reimbursement/network`
- `GET /api/analytics/reimbursement/clinics`
- `GET /api/analytics/reimbursement/payers`
- `GET /api/analytics/reimbursement/underpayments`

## Permission Additions

- `analytics.read`
- `analytics.manage`

## Deferred Follow-Ups

- contract-aware expected reimbursement baselines
- underpayment root-cause taxonomy
- richer analytics visualization and trend overlays
- proactive alerting and workflow automation for underpayment cohorts
