# Phase 3C Closeout: MSO Command Center

## What Changed

- Added a unified command center aggregation service for executive and operational summaries.
- Added organization-scoped command center API routes.
- Added dedicated `/command-center` dashboard page as the MSO operating console.
- Added command center permission primitives and role mappings.
- Added command center architecture documentation.

## Files Added

- `server/services/analytics/command-center.service.ts`
- `app/api/command-center/executive-summary/route.ts`
- `app/api/command-center/alerts/route.ts`
- `app/api/command-center/clinics/route.ts`
- `app/api/command-center/pa-ops/route.ts`
- `app/api/command-center/revenue-ops/route.ts`
- `app/api/command-center/support-ops/route.ts`
- `app/(dashboard)/command-center/page.tsx`
- `docs/mso-command-center.md`
- `docs/phase-3c-command-center-closeout.md`

## Files Updated

- `lib/rbac/permissions.ts`
- `lib/rbac/check.ts`
- `components/layout/nav.tsx`
- `middleware.ts`

## Routes Added

- `GET /api/command-center/executive-summary`
- `GET /api/command-center/alerts`
- `GET /api/command-center/clinics`
- `GET /api/command-center/pa-ops`
- `GET /api/command-center/revenue-ops`
- `GET /api/command-center/support-ops`

## Permission Additions

- `commandCenter.read`
- `commandCenter.manage`

## Schema Changes

- none for this sprint

## Follow-Up Ideas (Phase 4+)

- alert subscriptions/notification routing
- trend and forecast cards in command center
- staffing and capacity overlays
- service-line expansion readiness scoring
- richer executive reporting export surfaces
