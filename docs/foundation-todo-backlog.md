# Kalevea Foundation TODO Backlog

This backlog consolidates deferred work and known follow-ups from all completed foundation phases so they can be addressed after the foundation track is complete.

## How to use this file

- Keep items scoped to operational platform work (not EMR features).
- Prefer linking implementation PRs/commits to the item ID.
- Move completed items into a dated "Completed" section in future updates.

## Cross-Phase Platform / Technical Debt

- **[TD-001] Next.js middleware to proxy migration**
  - Source: `middleware.ts` (`TODO(tech-debt)`)
  - Notes: migrate middleware convention to Next.js proxy convention.
- **[TD-002] Workflow primitives adoption expansion**
  - Source: `docs/architecture/kalevea_phase_current_deep_dive.md`
  - Notes: workflow primitives exist but are not yet wired into all core modules.
- **[TD-003] PWA offline strategy**
  - Source: `docs/architecture/kalevea_phase_current_deep_dive.md`
  - Notes: foundation has PWA basics; full offline/service-worker behavior deferred.

## Auth / Identity (Phase 2A + 2A.1)

- **[ID-001] Tokenized invite + transactional email**
  - Source: `server/services/auth/invite.service.ts` (`TODO(phase-2b)`)
  - Notes: signed invite token issuance and real email delivery flow.
- **[ID-002] Full invite UX hardening**
  - Source: `docs/auth-architecture.md`, `docs/identity-admin.md`
  - Notes: move from internal/admin stub to polished invitation operations UX.

## Document Pipeline (Phase 2B + 2B.1)

- **[DOC-001] Expanded MIME/content validation depth**
  - Source: `docs/phase-2b1-document-hardening.md`
  - Notes: future content-sniffing/advanced file validation beyond MIME + checksum.
- **[DOC-002] Workflow attachment UX improvements**
  - Source: current document/workflow integration behavior
  - Notes: better parent-aware upload/attach flows in module UIs.

## Prior Authorization (Phase 2C)

- **[PA-001] Case workspace UX expansion**
  - Source: Phase 2C closeout notes
  - Notes: richer dedicated case page and workflow controls.
- **[PA-002] Payer workflow automation**
  - Source: `docs/prior-auth-engine.md` deferred section
  - Notes: payer-specific rules, appeals workflow, and submission transport integrations.
- **[PA-003] Structured document picker for PA linkage**
  - Source: current minimal UI approach
  - Notes: replace manual doc-id entry with scoped selector.

## Buy-and-Bill (Phase 2D)

- **[BNB-001] Append-only inventory ledger**
  - Source: `docs/buy-and-bill-engine.md`
  - Notes: MedGuard-derived immutable stock event model.
- **[BNB-002] FIFO / lot allocation policy**
  - Source: `docs/buy-and-bill-engine.md`
  - Notes: deterministic lot-pick strategy and operational safeguards.
- **[BNB-003] Reservation / hold mechanism**
  - Source: `docs/buy-and-bill-engine.md`
  - Notes: reserve quantity before administration submission.
- **[BNB-004] Administration reversal/correction flows**
  - Source: `docs/buy-and-bill-engine.md`
  - Notes: controlled correction path for operational errors.
- **[BNB-005] Reimbursement intelligence integration**
  - Source: `docs/phase-2d-buy-and-bill-closeout.md`
  - Notes: richer reimbursement visibility and claim/payer response workflows.

## Claims / Reimbursement Roadmap

- **[CLM-001] Manual reconciliation workflow**
  - Source: `docs/era-ingestion.md`
  - Notes: queue/action UX for unmatched or ambiguous ERA lines with operator overrides.
- **[CLM-002] ERA parser depth + partner variants**
  - Source: `docs/era-ingestion.md`
  - Notes: expand 835 loop support and normalization for additional payer/clearinghouse formats.
- **[CLM-003] ERA idempotency + duplicate safeguards**
  - Source: `docs/phase-2f-era-closeout.md`
  - Notes: duplicate ingestion detection and replay-safe processing controls.
- **[CLM-004] Contract-aware underpayment classification**
  - Source: `docs/reimbursement-analytics.md`
  - Notes: move from baseline variance flags to payer-contract-aware underpayment signals.
- **[CLM-005] Trend analytics + proactive alerting**
  - Source: `docs/phase-2g-analytics-closeout.md`
  - Notes: longitudinal benchmarking, cohort monitoring, and event-driven notifications.
- **[CLM-006] Claim engine depth**
  - Source: `docs/product/kalevea-mvp-modules.md`
  - Notes: adjudication-aware claim intelligence beyond foundational visibility.

## REMS / Compliance

- **[REMS-001] Expanded REMS automation**
  - Source: `docs/architecture/rems-mvp.md`
  - Notes: deeper requirement automation and broader compliance workflows.

## Notes

- This backlog intentionally excludes completed foundational work.
- All future implementation should preserve multi-tenant scoping, RBAC permission checks, and PHI-safe logging.
