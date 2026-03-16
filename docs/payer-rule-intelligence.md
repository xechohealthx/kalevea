# Payer Rule Intelligence (Phase 3A)

## Purpose

Phase 3A adds a structured payer rule intelligence layer with AI-assisted extraction. AI is used for suggestion generation only; approved rules in Kalevea remain the system of record.

## Existing Payer Context (Audit)

Before this phase, payer context already existed in:

- `PriorAuthorizationCase.payerName`
- `ReimbursementCase.payerName`, `expectedAmount`, `expectedAllowedAmount`
- `ClaimRecord.payerName`, claim identifiers (`claimNumber`, `externalClaimId`)
- `RemittanceFile.payerName`
- `PaymentRecord` linked to reimbursement and claim records

This enabled deterministic matching and guidance without redesigning existing reimbursement/PA domains.

## Domain Models

### `PayerRule`

Structured, queryable payer guidance with optional scope dimensions:

- organization/global scope (`organizationId` nullable)
- optional clinic/medication/state/service-context refinements
- expected reimbursement guidance fields
- confidence/source metadata
- active/effective windows

### `PayerRuleEvidence`

Evidence links from a rule to source documents with provenance notes.

### `PayerRuleSuggestion`

AI-generated candidate rules for human review:

- stores structured JSON candidate payload
- keeps source document and model metadata
- lifecycle: `DRAFT` -> `APPROVED` / `REJECTED`

## Rule Matching

Implemented in `server/services/payer-rules/payer-rule.service.ts`.

Matching workflow:

1. payer exact match (required)
2. medication specificity
3. clinic specificity
4. state specificity
5. service context specificity

Rules are ranked by deterministic scoring and filtered by active/effective windows.

## Reimbursement Guidance

`getExpectedReimbursementGuidance()`:

- selects top matching reimbursement rule
- returns expected amount/range and confidence metadata
- exposed as read-only guidance in reimbursement case detail

## AI Extraction Architecture

Implemented in `server/services/payer-rules/payer-rule-ai.service.ts`.

Flow:

1. pick source document from existing document pipeline
2. read document text from S3
3. send extraction request to OpenAI with strict JSON schema output
4. validate response with Zod
5. persist `PayerRuleSuggestion` rows as `DRAFT`

AI output never auto-activates rules.

## Review Workflow

- `approveSuggestion()` converts a suggestion into `PayerRule` and marks suggestion `APPROVED`
- `rejectSuggestion()` marks suggestion `REJECTED`
- approvals are explicit operator actions through API/UI

## Permissions

Added:

- `payerRules.read`
- `payerRules.manage`

Enforced across services and API routes using existing permission architecture.

## API Surface

- `GET /api/payer-rules`
- `POST /api/payer-rules`
- `PATCH /api/payer-rules/[ruleId]`
- `GET /api/payer-rules/suggestions`
- `POST /api/payer-rules/extract`
- `POST /api/payer-rules/suggestions/[id]/approve`
- `POST /api/payer-rules/suggestions/[id]/reject`

## UI Surfaces

- `app/(dashboard)/payer-rules/page.tsx` for rule management + suggestion review
- read-only payer guidance snippets in:
  - `app/(dashboard)/prior-auth/page.tsx`
  - `app/(dashboard)/reimbursement/page.tsx`

## Security and Data Handling

- no PHI stored in payer rule/suggestion structures
- audit entries for create/update/extract/approve/reject actions
- tenant scoping and permission checks on all read/write paths
