# Kalevea MVP Modules

This document defines what is **in scope now** (Core foundation + first engine) and what is intentionally **deferred** to later modules/engines.

---

## In scope (current phase)

### Core platform foundation

- **Multi-tenant architecture**: Organization + Clinic boundaries
- **Authentication + session management**: dev/local credentials scaffold, replaceable later
- **RBAC + Permissions**: role grants + permission contract for authorization
- **Organization / clinic / user model**
- **Dashboard shell**: sidebar navigation + header + foundation dashboards
- **Clinic onboarding engine**: projects + tasks + status board
- **Provider and staff management**: clinic-scoped directories
- **Support center**: ticketing + comments
- **Training / education scaffolding**: courses + lessons + assignments
- **Document management foundation**: server-side metadata + storage key abstraction
- **Shared workflow primitives**: notes, tasks, activity, status events, attachments (cross-module)
- **Audit logging**: for core mutations
- **Modular architecture**: clean services layer per domain

### Engine 1: REMS MVP

- **REMS programs** (templates)
- **Clinic + provider enrollments**
- **Requirements scaffolding**
- **Attestations**
- **Readiness visibility** (MVP; primarily attestation-based completion)

---

## Intentionally deferred (not built yet)

- Full **Claims Engine** (reconciliation, adjudication ingestion, underpayment detection pipelines)
- Full **Prior Authorization Engine** (payer rules, submission channels, full workflow automation)
- Full **Inventory Engine** (append-only ledger, lot/NDC traceability, controlled medication workflows)
- Clearinghouse integrations
- Patient portal / patient-facing experiences
- Marketing CRM / lead management
- Advanced automation rules engine

---

## Next modules to add (future-ready roadmap)

### PA engine
- Authorization workflows (create/track/attachments/status)
- Integration surface for documents + audit + clinic scoping

### Buy & Bill engine
- Purchasing + charge capture foundations
- Clinic operational views and reconciliation hooks

### Claim engine (ClaimSens-derived)
- Claim intelligence and reconciliation
- Underpayment detection + analytics/dashboards

### Inventory engine (MedGuard-derived)
- Append-only inventory event ledger
- NDC/lot traceability and controlled medication workflows

### Lead routing engine
- Provider capacity + clinic intake routing
- Operational handoffs (non-EMR)

# Kalevea MVP Modules (Core Platform Foundation)

This document defines what is **in scope now** (Core foundation) and what is intentionally **deferred** to later modules/engines.

---

## In scope (this phase)

### Core platform foundation

- **Multi-tenant architecture**: Organization + Clinic boundaries
- **Authentication + session management**: dev/local credentials scaffold, replaceable later
- **RBAC + Permissions**: role grants + permission contract for authorization
- **Organization / clinic / user model**
- **Dashboard shell**: sidebar navigation + header + foundation dashboards
- **Clinic onboarding engine**: projects + tasks + status board
- **Provider and staff management**: clinic-scoped directories
- **Support center**: ticketing + comments
- **Training / education scaffolding**: courses + lessons + assignments
- **Document management foundation**: server-side metadata + storage key abstraction
- **Shared workflow primitives**: notes, tasks, activity, status events, attachments (cross-module)
- **Audit logging**: for core mutations
- **Modular architecture**: clean services layer per domain
- **REMS MVP engine**: programs, enrollments, requirements, attestations, readiness views

---

## Intentionally deferred (not built in this phase)

- Full **Claims Engine** (reconciliation, adjudication ingestion, underpayment detection pipelines)
- Full **Prior Authorization Engine** (payer rules, submission channels, full workflow automation)
- Patient portal / patient-facing experiences
- Marketing CRM / lead management
- Advanced automation rules engine
- Clearinghouse integrations

---

## Next modules to add (future-ready roadmap)

### PA engine
- Authorization workflows (create/track/attachments/status)
- Integration surface for documents + audit + clinic scoping

### Buy & Bill engine
- Purchasing + charge capture foundations
- Clinic operational views and reconciliation hooks

### REMS engine
- Compliance checklists, attestations, training gating
- Workflow hooks into onboarding, documents, and audit logs

### Claim engine (ClaimSens-derived)
- Claim intelligence and reconciliation
- Underpayment detection + analytics/dashboards

### Inventory engine (MedGuard-derived)
- Append-only inventory event ledger
- NDC/lot traceability and controlled medication workflows

### Lead routing engine
- Provider capacity + clinic intake routing
- Operational handoffs (non-EMR)

