# Predictive Operations & Strategic Intelligence (Phase 5)

## Purpose

Phase 5 adds deterministic predictive intelligence on top of Kalevea's existing analytics stack. The goal is to anticipate risk and operational bottlenecks before they become reactive incidents.

This phase intentionally avoids heavy ML infrastructure and instead uses:

- moving averages
- trend slope projections
- payer and clinic baselines
- rule-based confidence scoring

## Predictive Signal Model

`PredictiveSignal` stores generated predictive outcomes:

- `signalType`
  - `PAYMENT_DELAY_RISK`
  - `UNDERPAYMENT_RISK`
  - `PA_DENIAL_RISK`
  - `ONBOARDING_DELAY_RISK`
  - `REVENUE_FORECAST`
- `predictedOutcome`
- `confidenceScore`
- `explanation`
- scoped by organization and optional clinic/payer

## Predictive Analytics Service

Service: `server/services/analytics/predictive-analytics.service.ts`

Core functions:

- `predictPaymentTimeline()`
- `predictUnderpaymentRisk()`
- `predictPayerVarianceTrend()`
- `predictClinicOperationalRisk()`
- `predictExpectedRevenue()`
- `generatePredictiveSignals()`
- `listPredictiveSignals()`

### Methodology highlights

- **Payment timeline risk**: combines clinic baseline lag + tail latency (P90)
- **Underpayment risk**: payer underpayment rate + variance pressure projection
- **Payer variance trend**: recent snapshot slope extrapolation
- **Clinic risk**: command-center risk score projection with denial pressure
- **Revenue forecast**: aggregate expected vs forecast from deterministic reimbursement forecasting

## API Surface

- `GET /api/analytics/predictive/revenue`
- `GET /api/analytics/predictive/payment-risk`
- `GET /api/analytics/predictive/clinic-risk`
- `GET /api/analytics/predictive/payer-risk`

Each endpoint supports tenant-scoped filtering and optional `refresh` generation flow.

## Predictive Dashboard

Page: `app/(dashboard)/analytics/predictive/page.tsx`

Sections:

- predicted revenue trend
- predicted payment timeline risk
- clinic operational risk forecast
- payer underpayment risk
- generated predictive signals

## Kal Predictive Explanations

`kal-assistant.service.ts` now includes:

- `explainPredictedRevenueRisk()`
- `explainPredictedPaymentDelay()`
- `explainClinicOperationalForecast()`

Kal can now explain predictive outputs in human-readable terms and operational next steps.

## Automation Integration

Predictive signal generation can dispatch to automation using:

- `dispatchPredictiveSignalsToAutomation()`

This maps predictive signal types to existing automation rule families and keeps actions inside established automation primitives.

## Safety

- no PHI is introduced in predictive models or logs
- deterministic methods only
- no autonomous financial mutation
- predictive outputs are decision support, not execution authority
