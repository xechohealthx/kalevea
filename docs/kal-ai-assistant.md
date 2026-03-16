# Kal AI Assistant

## Purpose

Phase 4C introduces **Kal**, a tenant-aware AI operations copilot for Kalevea. Kal is designed to help operators interpret platform data and recommend human-confirmed actions across operational domains.

Kal is intentionally implemented as a guidance layer:

- no direct autonomous mutations of financial records
- no direct database querying from AI logic
- no PHI in prompts, responses, or logs

## Architecture

Kal is implemented with two core services:

- `server/services/ai/kal-context.service.ts`
  - builds structured context via internal service tools
  - enforces tenancy and `aiAssistant.read` permissions
  - returns scoped operational datasets for prompting
- `server/services/ai/kal-assistant.service.ts`
  - orchestrates OpenAI request/response
  - enforces strict JSON output contract
  - provides deterministic fallback when OpenAI is unavailable
  - records audit-safe execution events

## Tool-Based Context Integration

Kal uses platform tools (service calls), not raw SQL/Prisma in assistant orchestration:

- `getClinicBenchmarkSummary`
- `getReimbursementVariance`
- `listUnderpaidCases`
- `getPayerRules`
- `getAutomationAlerts`
- `getOnboardingProgress`
- `getPAAttentionCases`
- `getRevenueOpportunities`

These map to existing analytics and operations services and preserve all existing authorization checks.

## API Surface

- `POST /api/ai/kal/query`
  - input: query, org/clinic scope, intent
  - output: structured assistant response with findings + recommended actions
- `GET /api/ai/kal/context`
  - returns the structured context bundle used for Kal analysis

Both endpoints are authenticated, tenant-scoped, and permission-guarded.

## Prompt Safety

Safety controls:

- sanitize emails/phone-like values from user query/context before prompt
- provide only operational analytics context fields
- prohibit autonomous actions in system prompt
- require `requiresHumanConfirmation: true` for all suggested actions

## UI Integration

- `app/(dashboard)/kal/page.tsx`
- `components/kal/kal-assistant-panel.tsx`

The panel includes:

- quick question templates
- scoped org/clinic selection
- intent selection (operations, reimbursement, onboarding, etc.)
- structured response rendering (summary/findings/actions/follow-ups)

## Permissions

Added permission:

- `aiAssistant.read`

Mapped through existing role-permission model to maintain consistent authorization boundaries.
