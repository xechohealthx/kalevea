# Operational Automation Engine (Phase 4A)

## Purpose

Phase 4A introduces Kalevea's reusable operational automation framework. This separates automation logic from domain services and enables deterministic, organization-scoped action triggers.

## Domain Model

### `AutomationRule`

- `organizationId`
- `ruleType`
- `conditionConfig` (JSON)
- `actionConfig` (JSON)
- `isActive`
- `createdByUserId`
- timestamps

### `AutomationEvent`

- link to `ruleId`
- `organizationId`
- trigger metadata (`triggeredAt`, target entity type/id, action executed)
- execution result (`status`, optional `errorMessage`)
- optional event `metadata`

## Rule Types

Initial deterministic rule types:

- `UNDERPAYMENT_ALERT`
- `PA_STUCK_ALERT`
- `PAYMENT_DELAY_ALERT`
- `DOCUMENTATION_MISSING`

These are evaluated by direct operational queries over existing domains (PA, reimbursement, payment, workflow attachment state).

## Action Types

Initial supported actions:

- `createOperationalAlert` (activity event)
- `createTask` (workflow task creation)
- `notifyUser` (activity-based notification placeholder)

Actions are executed through the automation service and reuse workflow primitives where applicable.

## Evaluation Flow

1. load active rules for organization
2. evaluate each rule via deterministic target query
3. trigger action per target
4. record `AutomationEvent` for each execution
5. write audit/log entries for run metadata

Duplicate suppression is applied for recent identical rule-target-action combinations.

## API Surface

- `GET /api/automation/rules`
- `POST /api/automation/rules`
- `PATCH /api/automation/rules/[ruleId]`
- `POST /api/automation/run`

## UI Surface

- `app/(dashboard)/automation/page.tsx`
  - rule list
  - rule create form
  - enable/disable controls
  - manual run trigger
  - recent event history

## Security and Scope

- organization-scoped access checks are mandatory
- permission-guarded with `automation.read` and `automation.manage`
- no PHI in automation output/log payloads

## Scheduler Strategy

Current phase uses a manual trigger endpoint (`POST /api/automation/run`) to avoid fragile cron coupling.

Future phases can add scheduled execution using this same service API entrypoint without moving automation logic into ad-hoc scripts.
