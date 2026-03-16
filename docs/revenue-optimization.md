# Revenue Optimization Engine

## Purpose

Phase 4B adds a guidance layer on top of reimbursement intelligence, analytics, and automation. The goal is to identify revenue risk and provide deterministic suggestions for operational follow-up without introducing autonomous financial decisions.

## Data Sources

Revenue optimization signals are generated from existing platform entities:

- `ReimbursementCase` (expected amounts, payer, clinic, status, underpayment flag)
- `ClaimRecord` (denied/rejected statuses for appeal opportunities)
- `PaymentRecord` (actual paid totals)
- `PayerRule` guidance (optional deterministic expected reimbursement context)
- Existing underpayment and variance calculations from reimbursement analytics

## Signal Model

`RevenueOptimizationSignal` is organization-scoped and optionally clinic/case-scoped:

- `signalType`: `APPEAL_OPPORTUNITY`, `HIGH_VARIANCE_RISK`, `PAYER_PATTERN_ALERT`, `FORECAST_RISK`
- `signalSeverity`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `recommendedAction`: short operator action recommendation
- `explanation`: deterministic explanation for why signal exists

Signals are deduplicated within a 24-hour window for the same key dimensions (org, clinic, payer, case, signal type).

## Forecasting Logic

`forecastExpectedReimbursement()` is deterministic and non-ML:

1. Collect open reimbursement cases (`EXPECTED` through `PARTIALLY_PAID`).
2. Compute payer historical paid-to-expected ratios from prior cases.
3. Optionally apply payer-rule reimbursement guidance if available.
4. Produce forecast amount + forecast risk percentage versus expected.
5. Classify risk severity based on negative forecast gap thresholds.

## Optimization Signal Generation

`generateRevenueOptimizationSignals()` builds signals from:

- Underpayment opportunities
- Appeal candidates
- Payer variance pattern alerts
- Forecast risk rows

The service writes an audit-safe batch record and supports optional automation handoff.

## Automation Integration

Revenue signals are dispatched into the Phase 4A automation engine through `dispatchRevenueSignalsToAutomation()`.

- High/critical revenue signals map to existing automation rule families.
- Rules execute existing automation actions (`createOperationalAlert`, `createTask`, `notifyUser`).
- Existing duplicate suppression in automation events continues to apply.

## API Surface

- `GET /api/revenue/signals` (optional `refresh=true` to generate before listing)
- `GET /api/revenue/forecast`
- `GET /api/revenue/opportunities`

All routes require auth, tenant-scoped access, and `revenue.read` permissions. Signal generation requires `revenue.manage`.

## Permissions

Added permissions:

- `revenue.read`
- `revenue.manage`

These are mapped through existing role-permission assignments and are separate from reimbursement permissions to keep optimization actions explicitly controlled.
