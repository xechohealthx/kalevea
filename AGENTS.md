# Kalevea Engineering + UI Agent Guide

## Product context

Kalevea is a production-grade multi-tenant SaaS/PWA operations platform for a treatment-network MSO.

Kalevea is **not an EMR**.

It is the operational platform around the EMR for:

* clinic onboarding
* provider and staff management
* operational support
* training and education
* document workflows
* compliance workflows
* operational dashboards

Future engines include:

* prior authorization
* buy and bill
* claims analytics
* inventory management

## Core platform constraints

* Do not store or generate PHI.
* Maintain explicit multi-tenant boundaries.
* Organization is the tenant.
* Clinics operate inside organizations.
* UI must reinforce this model.

## Technical stack

* Next.js App Router
* TypeScript
* Tailwind
* shadcn primitives
* Prisma
* PostgreSQL
* Zod
* TanStack Query

## UI system

Follow the design system defined in:

`docs/design/kalevea-ui-system.md`

The Kalevea UI should feel:

* modern
* premium
* calm
* operationally dense
* highly structured
* not like a template dashboard
* not like an EMR

Prefer:

* reusable system components
* contextual entity panels
* operational timelines
* queue-style tables
* restrained color usage

Avoid:

* template dashboards
* heavy gradients
* marketing-style UI
* page-specific styling

## Frontend rules

* Prefer server components.
* Use client components only for interactivity.
* Reuse `components/system` primitives.
* Avoid duplicating UI patterns across modules.
* Keep components strongly typed.
