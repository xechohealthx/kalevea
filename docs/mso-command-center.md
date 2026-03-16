# MSO Command Center

## Purpose

Phase 3C introduces a unified MSO operating console that consolidates executive and operational network metrics into one organization-scoped surface.

The command center is designed for:

- MSO leadership
- implementation managers
- PA operations leads
- billing/revenue operations leads
- analysts

It is not a replacement for detailed module workflows; it is the cross-network control layer.

## Data Sources by Section

### Executive Summary

- `Clinic` (active/onboarding counts)
- `PriorAuthorizationCase` (open PA load, approval rate)
- `BuyAndBillCase` (stage distribution)
- `ReimbursementCase` + `PaymentRecord` (expected/paid/variance)

### Operational Alerts

Computed from:

- underpayment counts
- open variance thresholds
- PA backlog and denial volume
- payment lag patterns
- support stale backlog
- clinic risk distribution

### Clinic Health Summary

Composite model using:

- onboarding progress (`ClinicOnboardingProject`, `OnboardingTask`)
- PA throughput/approval (`PriorAuthorizationCase`)
- reimbursement outcome + underpayment (`ReimbursementCase`, `PaymentRecord`)
- support burden (`SupportTicket`)
- training completion (`TrainingAssignment`)

### PA Operations Summary

- status distribution
- approval/denial totals
- pending payer backlog
- requiring-action counts
- payer concentration by volume

### Revenue Operations Summary

- buy-and-bill stage distribution
- reimbursement status distribution
- expected vs paid vs open variance
- underpayment counts
- top payer and clinic variance contributors

### Support/Training Ops (lightweight)

- open/stale/urgent support ticket counts
- training completion rate

## Service Design

Primary service:

- `server/services/analytics/command-center.service.ts`

Functions:

- `getExecutiveSummary()`
- `getOperationalAlerts()`
- `getClinicHealthSummary()`
- `getPAOpsSummary()`
- `getRevenueOpsSummary()`
- `getSupportOpsSummary()`

Design approach:

- organization-scoped, permission-guarded aggregation
- reuse existing model semantics instead of introducing new warehouse structures
- output dashboard-ready payloads

## Alert Logic (Foundation Rules)

Current computed alert rules include:

- high underpayment volume
- open reimbursement variance threshold breach
- PA backlog/denial concentration
- slow payment timeline pockets
- stale support backlog
- at-risk clinic concentration

These are deterministic rules intended for operational triage, not a notification engine.

## Clinic Health Methodology

Each clinic receives a `riskScore` and health band:

- `HEALTHY`
- `WATCH`
- `AT_RISK`

Score inputs (weighted):

- underpayment rate
- payment lag
- PA approval performance
- support burden
- onboarding progress

## Security and Scope

- all command center endpoints are authenticated
- all responses are organization scoped
- permission guarded with `commandCenter.read` (and future `commandCenter.manage`)
- no PHI in aggregate responses or logs

## Expansion Roadmap

Future extensions can include:

- alert subscriptions and routing
- forecast projections
- staffing/capacity overlays
- service-line expansion readiness
- executive trend packs and board-ready reporting views
