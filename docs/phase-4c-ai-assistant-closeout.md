# Phase 4C Closeout: AI Operations Assistant (Kal)

## What Changed

Phase 4C added a scoped AI copilot layer (`Kal`) that explains platform insights and recommends human-confirmed actions across onboarding, PA operations, reimbursement, and revenue optimization.

Implemented:

- AI context builder with tool-based service integration
- Kal assistant service with structured JSON responses and fallback mode
- API routes for querying Kal and fetching context
- Minimal Kal dashboard panel with templates and response rendering
- New `aiAssistant.read` permission integrated into RBAC mappings
- Navigation and middleware updates

## Files Added

- `server/services/ai/kal.schemas.ts`
- `server/services/ai/kal-context.service.ts`
- `server/services/ai/kal-assistant.service.ts`
- `app/api/ai/kal/query/route.ts`
- `app/api/ai/kal/context/route.ts`
- `components/kal/kal-assistant-panel.tsx`
- `app/(dashboard)/kal/page.tsx`
- `docs/kal-ai-assistant.md`
- `docs/phase-4c-ai-assistant-closeout.md`

## Files Modified

- `lib/rbac/permissions.ts`
- `lib/rbac/check.ts`
- `components/layout/nav.tsx`
- `middleware.ts`

## Routes Added

- `POST /api/ai/kal/query`
- `GET /api/ai/kal/context`
- UI: `/kal`

## Permission Changes

Added:

- `aiAssistant.read`

Integrated through existing role-permission mappings for global/org/clinic roles.

## Safety Notes

- Kal uses existing service tools; no raw assistant-side data mutation
- Responses are structured and action-oriented
- All suggested actions explicitly require human confirmation
- Prompt/context sanitization avoids direct PHI-like values

## Deferred Follow-Ups

- Add conversation persistence and history threading
- Add approval workflow to convert Kal suggestions into automation or tasks in one click
- Add scoped prompt templates by role persona (billing specialist, PA specialist, implementation manager)
- Add monitoring dashboard for Kal tool reliability and response quality
