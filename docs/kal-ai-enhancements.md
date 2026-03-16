# Kal AI Practical Enhancements (Phase 4C.1)

## Purpose

Phase 4C.1 upgrades Kal from a general assistant panel into a practical operational interpreter:

- explainability for current screens and metrics
- contextual insight cards for clinics, payers, and revenue
- onboarding readiness and blocker analysis
- diagnostics for operational anomalies
- structured, human-confirmed recommendation generation

The architecture from Phase 4C remains intact. This phase extends that architecture with specialized services and routes.

## Explainability System

Service: `server/services/ai/kal-explain.service.ts`

Functions:

- `explainDashboardMetrics()`
- `explainClinicPerformance()`
- `explainReimbursementVariance()`
- `explainUnderpaymentSignal()`

This layer combines structured diagnostics with Kal query orchestration so responses include:

- what metrics mean
- likely anomaly causes
- what operators should investigate next

## Insight Generation

Service: `server/services/ai/kal-insight.service.ts`

Functions:

- `getClinicInsights()`
- `getPayerInsights()`
- `getRevenueInsights()`

Insights are deterministic, card-ready summaries with severity labels and operator-facing messages.

## Onboarding Analysis

Service: `server/services/ai/kal-onboarding-analysis.service.ts`

Functions:

- `analyzeClinicOnboardingReadiness()`
- `identifyOnboardingBlockers()`

Inputs combine onboarding tasks with provider count, REMS enrollment status, and document presence to estimate readiness and missing areas.

## Diagnostics Architecture

Service: `server/services/ai/kal-diagnostics.service.ts`

Functions:

- `analyzeRevenueAnomalies()`
- `analyzePAWorkflowIssues()`
- `analyzeClinicOperationalRisk()`

Diagnostics reuse existing command-center and revenue services and convert outputs into root-cause signals.

## Action Recommendation Layer

Service: `server/services/ai/kal-action-recommendation.service.ts`

Function:

- `generateOperationalActions()`

Recommendations map to existing operational action patterns:

- `createTask`
- `createOperationalAlert`
- `notifyUser`
- `reviewOnly`

All recommendations include `requiresHumanConfirmation: true`.

## Tool Expansion

Kal tool context now includes:

- `getClinicBenchmarkSummary`
- `getReimbursementVariance`
- `getUnderpaidCases`
- `getRevenueSignals`
- `getPayerRules`
- `getAutomationAlerts`
- `getOnboardingProgress`
- `getPAAttentionCases`
- `getRevenueOpportunities`

## API Routes Added

- `POST /api/ai/kal/explain`
- `GET /api/ai/kal/insights`
- `GET /api/ai/kal/onboarding-analysis`
- `GET /api/ai/kal/recommendations`

Existing routes retained:

- `POST /api/ai/kal/query`
- `GET /api/ai/kal/context`

## UI Enhancements

`components/kal/kal-assistant-panel.tsx` now supports:

- **Explain this page** action
- contextual insight cards
- onboarding readiness summary cards
- quick recommended actions
- existing query flow and templates

Integration hooks were added to:

- `app/(dashboard)/command-center/page.tsx`
- `app/(dashboard)/clinics/[id]/page.tsx`
- `app/(dashboard)/reimbursement/page.tsx`

Each provides deep links into Kal with pre-scoped context and intent.

## Logging and Safety

Added logging/audit coverage for:

- explainability requests
- diagnostics-driven recommendation generation
- onboarding analysis calls

Safety posture remains:

- no PHI in prompt/log payloads
- tenant and permission checks before data access
- no autonomous financial mutations
