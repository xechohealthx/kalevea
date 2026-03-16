# Kalevea UI System v1

## North Star

Kalevea should feel like a category-defining healthcare operations platform: precise, calm, intelligent, operationally dense, and fast. It should not feel like a generic admin dashboard, a hospital EMR, or a marketing-heavy startup app.

The product should communicate four things immediately:

1. **Operational control** — users can see what needs attention now.
2. **Multi-tenant clarity** — the MSO can understand the network; clinics can understand their workspace.
3. **Workflow momentum** — every screen helps users move work forward.
4. **Audit-ready trust** — the system feels structured, reliable, and compliance-aware.

The UI should therefore blend:

* the workflow sharpness of Linear
* the structural clarity of Stripe Dashboard
* the composability of Notion
* the density and calmness of Vercel
* the confidence of a premium enterprise product

---

## 1) Product UX thesis

### The core UX idea

Kalevea is not a collection of pages. It is a set of **operational workspaces**.

Each workspace represents an operating surface for a real business domain:

* Network
* Clinics
* Onboarding
* Providers
* Support
* Training
* Documents
* REMS
* Later: Prior Auth, Buy & Bill, Claims, Inventory

Each workspace follows the same mental model:

* **Overview** — current status, metrics, bottlenecks
* **Queue** — things that need action
* **Entities** — records and directories
* **Timeline** — what changed and why
* **Artifacts** — documents, notes, attachments
* **Insights** — trend and completion views

This consistency makes the app feel expensive, coherent, and scalable.

### UX rules

1. Every screen should answer: **What is happening, what needs action, and what changed?**
2. Dense screens are acceptable if hierarchy is excellent.
3. Navigation depth should stay shallow.
4. Details should usually open in **side panels / drawers**, not full page transitions.
5. Empty states should educate and guide next steps.
6. Every important operational record should have:

   * status
   * owner
   * due date or freshness indicator
   * related activity
   * linked documents/notes/tasks when relevant

---

## 2) Brand and visual identity

### Brand personality

Kalevea should feel:

* modern
* composed
* sharp
* system-level
* trustworthy
* premium but not flashy
* healthcare-aware without looking clinical or stale

Avoid:

* rounded, bubbly “startup SaaS” visuals
* overly bright gradients everywhere
* generic bootstrap dashboard aesthetics
* heavy EMR-style clutter
* skeuomorphic healthcare visuals

### Visual language

Think: **dark operations cockpit + crisp light surfaces + selective signal color**.

The product should use restrained contrast and strong typography so the information feels premium.

---

## 3) Color system

Use a token-based semantic color system rather than hardcoded colors.

### Core neutrals

* `bg.app` — deep slate background
* `bg.surface` — primary panel/card background
* `bg.surfaceElevated` — overlays, drawers, popovers
* `bg.subtle` — section fills and table stripes
* `border.default` — low-contrast border
* `border.strong` — emphasized separators
* `text.primary` — main text
* `text.secondary` — supportive text
* `text.tertiary` — muted labels

### Signal colors

* `brand.primary` — Kalevea blue
* `brand.secondary` — deep cyan/teal accent
* `status.success` — completion / compliant / active
* `status.warning` — at risk / upcoming expiry / pending
* `status.danger` — blocked / expired / urgent
* `status.info` — contextual highlights

### Suggested palette direction

* App background: near-slate / near-graphite
* Surface: slightly lighter slate
* Brand primary: disciplined medical-tech blue
* Accent: teal for momentum / operations / “healthy flow”
* Danger: high-legibility red
* Warning: amber with restraint

### Color usage rules

* Use brand color sparingly for actions, focus states, and selected navigation.
* Use status colors mostly in badges, dots, timelines, and alert surfaces.
* Avoid full-screen saturated backgrounds.
* Metrics should use text hierarchy first, color second.
* Tables should rely on spacing and typography more than strong row fills.

---

## 4) Typography

### Font direction

Primary UI font: **Inter** or **Geist**.

Recommendation:

* UI/body: Inter
* Optional display/accent: Geist or a tighter grotesk for headers only

### Typography scale

* Display / Workspace title
* Section title
* Card title
* Body primary
* Body secondary
* Label
* Mono / metadata / ids

### Typography principles

* Large titles should feel editorial, not oversized.
* Small text should remain crisp and readable for data-dense interfaces.
* Use tabular numerals for metrics where possible.
* Use mono only for reference IDs, dates in tables, and operational metadata.

---

## 5) Spacing, radius, and depth

### Layout rhythm

Use an 8px spacing grid.

### Radius

* Global system radius: 16px for main surfaces
* Compact radius: 12px for inputs and subcards
* Chips/badges: pill or 9999px

### Elevation

* Most layout depth should come from contrast and borders, not heavy shadows.
* Shadows should be soft and premium.
* Overlays and side panels can have slightly stronger elevation.

### Density modes

Design for two density modes eventually:

* **Comfortable** — executives / broad users
* **Operational** — high-density tables and queues

Version 1 can default to a balanced density.

---

## 6) Iconography and illustration

### Icons

Use a single icon family such as **lucide-react**.

Rules:

* 16px icons for inline UI
* 18–20px for nav and panels
* 24px only for hero empty states

### Illustration

Do not rely on stock healthcare art.

Use instead:

* abstract system diagrams
* structured empty-state graphics
* quiet, geometric illustrations only where needed

---

## 7) Core layout architecture

Kalevea should use a **three-layer shell**.

### Layer 1 — Global shell

Persistent across the app:

* left rail / sidebar
* top command bar
* workspace content area
* right-side contextual panel when needed

### Layer 2 — Workspace shell

Within each module:

* workspace header
* subnav / tabs / filters
* overview band or page controls
* body content

### Layer 3 — Entity context

When an item is selected:

* side panel / sheet / split view
* tabs for summary, activity, documents, tasks, notes

This structure makes the product feel system-level rather than page-based.

---

## 8) Navigation system

### Primary navigation

Sidebar items:

* Dashboard
* Clinics
* Onboarding
* Providers
* Support
* Training
* Documents
* REMS

Later grouped section:

* Prior Auth
* Buy & Bill
* Claims
* Inventory

Bottom section:

* Analytics
* Settings

### Sidebar behavior

The sidebar should feel premium and compact.

Include:

* product mark / wordmark
* organization switcher or network label
* primary nav
* utility nav
* user profile menu

### Navigation states

* selected
* hover
* keyboard focus
* unread / count indicator
* at-risk dot or badge for certain modules

### Workspace switcher

Important future differentiator:

A switcher at the top left that can toggle among:

* MSO network view
* specific clinic workspace
* all clinics
* saved views

This reinforces multi-tenant intelligence.

---

## 9) Command layer

A premium enterprise product should have a **command palette**.

### Command palette capabilities

* jump to clinic
* jump to provider
* open support ticket
* create note/task/document metadata
* navigate to REMS items
* search commands
* filter views quickly

### Why it matters

This makes Kalevea feel fast, modern, and intentional.

---

## 10) The Kalevea page model

Every major workspace should be built from the same page model.

### A. Workspace header

Contains:

* title
* subtitle / operational context
* scope badge (network / clinic / program)
* primary actions
* secondary actions

### B. Overview strip

Contains:

* 3–5 key metrics
* alert / risk summary
* last updated context

### C. Main body split

Usually a two-column composition:

* left: primary operational surface
* right: timeline / alerts / tasks / secondary insights

### D. Optional lower band

* related entities
* document lists
* recent activity
* cross-links

This consistency should exist across all modules.

---

## 11) Entity-driven UX

Kalevea should treat operational objects as first-class entities.

Examples:

* clinic
* provider
* onboarding project
* onboarding task
* support ticket
* training assignment
* document
* REMS enrollment
* attestation

Each entity should have a consistent detail model.

### Universal entity detail pattern

Top area:

* title
* status
* key metadata
* owner/assignee
* freshness / due date

Tabs or sections:

* Summary
* Activity
* Tasks
* Notes
* Documents
* Related

This can be implemented via a reusable `EntityPanel` system.

---

## 12) Side panels as a signature pattern

Kalevea should use **right-side panels** heavily.

Examples:

* click clinic row → clinic quick view panel
* click provider → provider panel
* click ticket → ticket panel
* click REMS enrollment → compliance detail panel

### Benefits

* preserves context
* reduces navigation fatigue
* feels modern and fast
* supports operational triage

### Panel sizes

* small panel: lightweight preview
* medium panel: standard entity detail
* large panel: complex workflows

---

## 13) Table system

Tables are central to Kalevea.

### Principles

* Highly readable, not spreadsheet-chaotic
* Sticky headers where useful
* Column personalization in future
* Strong row hover and selected states
* Inline status, assignee, due date, freshness indicators

### Standard row anatomy

Each row can include:

* primary title
* secondary metadata
* status badge
* owner avatar / initials
* due date / expiry
* last activity
* quick actions

### Table variants

* standard entity table
* queue table
* audit/activity table
* compact dense table
* expandable table

---

## 14) Cards and metric surfaces

### Metric cards

Metric cards should feel premium, not dashboard-template generic.

Card anatomy:

* label
* main metric
* directional/supporting context
* optional sparkline later
* optional “why this matters” microcopy

Use metric cards mostly for:

* dashboard
* workspace overviews
* clinic readiness
* risk summaries

### Spotlight cards

Use larger spotlight cards for:

* launch blockers
* expiring enrollments
* support backlog risk
* training completion lag

---

## 15) Status system

Status is critical in operational software.

Create a reusable `StatusBadge` and `StatusPill` system.

### Required properties

* label
* semantic tone
* icon or dot optional

### Status families

* lifecycle: active, inactive, draft, archived
* workflow: todo, in progress, blocked, done
* compliance: enrolled, pending, expired, suspended
* operational: healthy, at risk, urgent

### Rules

* Status colors must be semantic and consistent globally.
* Avoid custom status styling per module unless absolutely necessary.

---

## 16) Activity and timeline system

One signature Kalevea differentiator should be the **Operational Timeline**.

### Timeline concept

Every important record should expose “what happened” in a structured feed.

Sources may include:

* status changes
* notes
* task updates
* attestations
* document attachments
* support comments

### Timeline anatomy

Each item includes:

* timestamp
* actor
* event type
* concise description
* optional metadata chips

### UX role

This creates a “single source of operational truth” feeling.

The timeline should become a core reusable component.

---

## 17) Alerts, banners, and urgency

### Alert levels

* info
* success
* warning
* danger

### Usage

Use inline alerts for record-specific issues.
Use top summary banners only for high-priority workspace-wide issues.

### Avoid

Do not litter the UI with warnings. Over-alerting makes the product feel noisy and low-trust.

---

## 18) Forms and data entry

Forms should feel refined and lightweight.

### Principles

* Chunk complex forms into sections
* Prefer progressive disclosure
* Use inline descriptions sparingly but clearly
* Keep validation immediate and precise

### Inputs

Create design rules for:

* text input
* textarea
* select
* combobox
* multiselect
* date picker
* assignee picker
* status picker
* file/document selector

### Complex workflows

For creation flows, prefer:

* modal for lightweight create
* side sheet for medium complexity
* full page only for high-complexity setup

---

## 19) Empty states

Great empty states are part of premium UX.

Each empty state should include:

* a clear title
* one-sentence explanation
* recommended next action
* optional secondary action

Examples:

* No clinics yet
* No onboarding projects
* No tickets in this queue
* No attestations recorded

Make them structured, not decorative.

---

## 20) Search, filters, and saved views

Search and filtering should be universal patterns.

### Standard toolbar anatomy

* search input
* one or more filters
* sort control
* density/view option later
* save view action later

### Why this matters

Operational teams live in queues, not just static pages.

Saved views later can be a major product differentiator for MSO ops teams.

---

## 21) Dashboard philosophy

The dashboard should not be a vanity dashboard.

It should answer:

* what is blocked
* what is expiring
* which clinics need intervention
* which queues are aging
* what changed since yesterday

### Dashboard sections

1. Global operational health
2. Risk & attention band
3. Network activity
4. Clinic readiness rankings
5. Recent workflow movement
6. Module-level queue summaries

The dashboard should feel like an operations nerve center.

---

## 22) Module-by-module UI design

### Dashboard

Purpose: fast orientation for MSO and clinic leaders.

Structure:

* top metrics strip
* “Needs attention now” cards
* clinic readiness / status table
* recent activity timeline
* queue summaries by module

### Clinics

Purpose: network directory + clinic workspace entry point.

Views:

* all clinics table
* map is optional later, not required
* per-clinic overview workspace

Clinic workspace sections:

* readiness
* staffing
* onboarding progress
* compliance / REMS summary
* documents
* support history
* activity

### Onboarding

Purpose: launch execution.

Views:

* projects board/list
* blockers panel
* milestone timeline
* task ownership views

### Providers

Purpose: provider and staff operations.

Views:

* provider directory
* staff directory
* credential/compliance summary surfaces later
* provider detail panel with activity and requirements

### Support

Purpose: high-signal ticket triage and resolution.

Views:

* ticket queues
* SLA / aging indicators
* ticket detail side panel and full page
* threaded comments

### Training

Purpose: operational enablement.

Views:

* course catalog
* assignment queue
* completion status by clinic/provider
* due/overdue surface

### Documents

Purpose: operational document metadata and attachment workflows.

Views:

* document list
* filter by type / clinic / owner / module
* attach to entity workflows
* recent uploads / recent attachments

### REMS

Purpose: compliance readiness and attestation workflow.

Views:

* program summary dashboard
* clinic readiness table
* expiring enrollments
* provider compliance snapshot
* clinic detail with requirements, attestations, timeline
* provider detail with enrollment and activity

This module should feel especially sharp because it is one of Kalevea’s first wedge products. The current repo already has REMS pages, services, and workflow primitives that support this direction. fileciteturn0file0

---

## 23) Core reusable component library

Create a Kalevea system layer in:

`components/system/`

### Layout

* `AppShell`
* `SidebarNav`
* `WorkspaceHeader`
* `WorkspaceSubnav`
* `ContextPanel`
* `CommandBar`
* `WorkspaceSwitcher`

### Data display

* `MetricCard`
* `MetricStrip`
* `StatusBadge`
* `EntityTable`
* `QueueTable`
* `Timeline`
* `ActivityFeed`
* `EmptyState`
* `StatList`

### Entity patterns

* `EntityHeader`
* `EntityPanel`
* `EntityMetaGrid`
* `RelatedItemsCard`
* `AssigneeCell`
* `DueDateCell`
* `FreshnessIndicator`

### Workflow

* `TaskComposer`
* `TaskList`
* `NoteComposer`
* `AttachmentList`
* `StatusChangeDialog`
* `AuditTrailCard`

### Utility

* `FilterBar`
* `SearchInput`
* `SavedViewMenu` later
* `ScopeBadge`
* `RiskIndicator`

---

## 24) Design tokens

Implement tokens in a first-class way.

### Token categories

* colors
* spacing
* radius
* shadows
* typography
* z-index
* motion durations

### Recommendation

Store semantic tokens centrally and keep Tailwind extensions aligned with them.

---

## 25) Motion system

Motion should be subtle and premium.

### Motion rules

* fast hover and focus transitions
* smooth side panel open/close
* table row hover emphasis
* card lift minimal
* avoid flashy spring animations for core workflows

### Good uses

* drawer transitions
* tab underline movement
* count updates
* subtle status changes

---

## 26) Accessibility

A premium enterprise product is accessible by default.

Requirements:

* keyboard-navigable sidebars, tables, dialogs, and menus
* visible focus styles
* sufficient contrast
* semantic headings
* table semantics
* screen-reader labels for status and icons

---

## 27) Responsive strategy

This product is desktop-first, but responsive.

### Recommended approach

* desktop: full shell and multi-column layouts
* tablet: compact shell and stacked secondary panels
* mobile: limited but usable for light workflows and review

Do not force every dense operational table into a perfect mobile experience in v1.

---

## 28) Content style

### Voice

* concise
* intelligent
* operational
* calm
* direct

### Writing rules

* Prefer “Needs attention” over “Alerts” when possible.
* Prefer action-oriented labels.
* Avoid EMR/legal jargon unless needed.
* Use plain language for statuses and instructions.

---

## 29) Implementation architecture for the existing repo

Kalevea already has a strong architectural base for this UI direction: multi-tenant foundation, dashboard shell, modular services, documents/training/support/onboarding modules, permissions, workflow primitives, and REMS pages. fileciteturn0file1

### Recommended front-end structure

```text
components/
  system/
    layout/
    navigation/
    data-display/
    entity/
    workflow/
    feedback/
    forms/
  module/
    clinics/
    onboarding/
    providers/
    support/
    training/
    documents/
    rems/
```

### Rules

* `system/*` = generic Kalevea design system components
* `module/*` = domain-specific compositions built from system components
* API and service contracts remain unchanged where possible
* Refactor page UIs incrementally, not all at once

---

## 30) Build sequence

### Phase 1 — Design foundations

1. Establish tokens
2. Refine app shell
3. Build sidebar and workspace header
4. Build metric cards, status badge, filter bar, entity table, empty state

### Phase 2 — Signature interaction patterns

5. Build context side panel system
6. Build timeline/activity system
7. Build entity header and detail compositions
8. Add command palette

### Phase 3 — Module refactors

9. Refactor dashboard
10. Refactor clinics workspace
11. Refactor REMS workspace
12. Refactor support/onboarding/providers/training/documents

### Phase 4 — Premium features

13. saved views
14. view personalization
15. denser operational mode
16. richer analytics surfaces

---

## 31) What will make Kalevea feel like a $100M SaaS product

The feeling will come less from gradients and more from these four things:

1. **System consistency** — same patterns everywhere
2. **Fast contextual workflows** — side panels, command palette, quick actions
3. **High information clarity** — excellent hierarchy in dense views
4. **Operational intelligence** — timelines, risk surfaces, queues, readiness states

That is the real premium layer.

---

## 32) Immediate next deliverables

Recommended next design outputs:

1. Kalevea visual token spec
2. App shell v2 wireframe
3. Dashboard redesign spec
4. Entity panel system spec
5. REMS workspace redesign spec
6. Component inventory with implementation priority

---

## 33) Cursor build prompts

### Prompt 1 — App shell v2

Build a premium enterprise app shell for Kalevea using Next.js, TypeScript, Tailwind, and shadcn-style primitives. Create a left sidebar, top command bar, workspace header, and content container that feels like a modern operations platform, not a generic dashboard. Use dark neutral surfaces, restrained borders, strong typography, and responsive layout. Keep the code modular and production-grade.

### Prompt 2 — Design system primitives

Create a `components/system` layer for Kalevea with reusable primitives: `MetricCard`, `StatusBadge`, `EntityTable`, `WorkspaceHeader`, `FilterBar`, `EmptyState`, and `Timeline`. These should be semantically styled, token-friendly, and suitable for dense healthcare operations workflows.

### Prompt 3 — Entity side panel

Build a reusable `EntityPanel` pattern for Kalevea that opens from the right side and displays an entity header, metadata grid, status badge, activity timeline, tasks, notes, and related documents. Make it usable for clinics, providers, tickets, and REMS entities.

### Prompt 4 — Dashboard redesign

Refactor the Kalevea dashboard page into a premium operations command center with a metrics strip, a “Needs attention now” band, clinic readiness table, module queue summary cards, and recent activity timeline. Keep the layout scalable and highly readable.

### Prompt 5 — REMS redesign

Redesign the Kalevea REMS pages to feel like a premium compliance workspace. Include summary metrics, readiness tables, expiring enrollments, requirement status visualization, recent attestations, and activity timeline. Use shared system components and preserve existing service/API contracts.
