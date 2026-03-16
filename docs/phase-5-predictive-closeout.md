# Phase 5 Closeout: Predictive Operations & Strategic Intelligence

## What Changed

Phase 5 introduced deterministic predictive analytics and signal generation across payment delay risk, underpayment risk, clinic operational risk, and expected revenue forecasting.

Added:

- predictive analytics service + signal generation pipeline
- predictive signal persistence model
- predictive API routes
- predictive analytics dashboard
- Kal predictive explanation functions
- automation handoff for predictive signals

## Schema Changes

Updated `prisma/schema.prisma`:

- added enum `PredictiveSignalType`
- added model `PredictiveSignal`
- added organization/clinic relations for predictive signals

## Services Added

- `server/services/analytics/predictive-analytics.service.ts`
- `server/services/analytics/predictive-analytics.schemas.ts`

## AI Changes

Updated:

- `server/services/ai/kal-assistant.service.ts`
  - added predictive explanation methods
- `server/services/ai/kal-context.service.ts`
  - expanded predictive-aligned tool selection and aliases
- `server/services/ai/kal.schemas.ts`
  - added `predictive` intent

## Automation Integration

Updated:

- `server/services/automation/automation-engine.service.ts`
  - added `dispatchPredictiveSignalsToAutomation()`
  - expanded automation target types to include `PredictiveSignal`

## API Routes Added

- `GET /api/analytics/predictive/revenue`
- `GET /api/analytics/predictive/payment-risk`
- `GET /api/analytics/predictive/clinic-risk`
- `GET /api/analytics/predictive/payer-risk`

## UI Added/Updated

- Added `app/(dashboard)/analytics/predictive/page.tsx`
- Updated sidebar navigation with Predictive analytics entry
- Updated Kal panel intent options to include predictive mode

## Documentation Added

- `docs/predictive-operations.md`
- `docs/phase-5-predictive-closeout.md`

## Deferred Follow-Ups

- add rolling weekly/monthly forecast windows and backtesting summaries
- add confidence calibration and forecast error tracking
- add operator-confirmed feedback loop for predictive signal usefulness
- add predictive drilldown cards by service line expansion cohorts
