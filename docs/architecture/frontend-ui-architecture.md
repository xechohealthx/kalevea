# Kalevea Frontend UI Architecture

## Goals

The frontend should:

* support a premium multi-tenant operations interface
* scale across many product modules
* remain visually consistent
* separate UI from domain logic

## Folder structure

components/

system/
layout/
navigation/
data-display/
entity/
workflow/
feedback/
forms/

clinics/
onboarding/
providers/
support/
training/
documents/
rems/

## Folder responsibilities

system/

Reusable UI primitives shared across the entire application.

Examples:

* AppShell
* SidebarNav
* WorkspaceHeader
* MetricCard
* StatusBadge
* EntityTable
* Timeline
* EntityPanel
* FilterBar
* EmptyState

module folders

Domain-specific compositions built from system primitives.

Examples:

components/rems/rems-readiness-table.tsx
components/clinics/clinic-overview.tsx

Do NOT recreate primitives here.

## Page composition model

Most workspace pages should follow this structure:

1. workspace header
2. metrics strip
3. primary operational surface
4. contextual secondary surface

This ensures visual consistency across modules.
