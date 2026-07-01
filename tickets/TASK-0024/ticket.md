---
ticket_id: TASK-0024
title: Tighten Team Panel goals/products/kanban/timeline tabs
phase: review
status: review
owner: Farplane UI
claimed_by: codex
priority: high
depends_on:
  - TASK-0023
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-06-28
updated_at: 2026-06-29
next_action: review Team Panel Overview/Goals/Distribution/Members against tickets/TASK-0024/design.md
last_verification: 2026-07-01; focused Team Workspace lint/tests plus browser proof for Overview, Goals, Distribution, Members, and mobile Distribution passed; full ui:typecheck remains blocked by existing repo-wide TS debt
---

# TASK-0024: Tighten Team Panel Goals, Products, Kanban, And Timeline Tabs

## Summary
Make the Team Panel tabs match the new file-backed Farplane posture:
Goals must not overflow, Products should read row-by-row, Kanban should be a
ticket-file browser instead of old board memory, Timeline should return as the
project decision/event spine, Telemetry stays, and Config leaves the main tab
strip.

## Scope
- In:
  - Wrap and constrain Goals KPI cards so long questions/providers never clip.
  - Render Goals/KPIs as dashboard rows with target, provider, evidence,
    cadence, and trend placeholders.
  - Render Products as scan-friendly product-shop rows with a light game/quest
    treatment.
  - Render Overview as a KPI cockpit with money made, user growth, viewer
    growth, and SMART-goal operating health.
  - Render Kanban cards from ticket frontmatter/metadata and open full
    `ticket.md` detail in the modal.
  - Keep Kanban lanes on one horizontal board row instead of wrapping into two
    columns.
  - Add `Timeline` beside Telemetry and feed it from memory/history docs first,
    then live communication/activity fallback.
  - Remove the visible Config tab from Team Panel.
- Out:
  - No ticket write-back for filesystem tickets.
  - No new external timeline provider.
  - No heavy product gamification system, animations, XP economy, or art assets.

## Delta
- Before: Goals clipped text, Products used plain cards, Kanban still surfaced
  task memory/edit controls from the old board model, Timeline was dormant, and
  Config consumed a top-level tab.
- After: The tab set is `Overview / Goals / Products / Kanban / Cadence /
  Timeline / Telemetry`; Overview leads with KPI cockpit cards, Goals renders
  schema-tolerant KPI rows, Products reads like a shop shelf, and Kanban stays
  in one horizontal board row.

## Map
- `ui/src/modules/team-workspace/components/team-panel.tsx`
- `ui/src/modules/team-workspace/components/team-panel-types.ts`
- `ui/src/modules/team-workspace/components/farplane-project-config.tsx`
- `ui/src/modules/team-workspace/components/kanban-task-card.tsx`
- `ui/src/modules/team-workspace/components/task-detail-modal.tsx`
- `ui/src/modules/team-workspace/components/timeline-tab.tsx`
- `ui/src/modules/team-workspace/components/team-timeline.ts`
- `ui/src/modules/team-workspace/components/use-team-panel-memory.ts`
- `ui/vite.config.ts`

## Done / Proof
- Goals tab shows long KPI text wrapped inside cards.
- Goals parser tolerates both weighted KPI tables and question-style KPI tables
  without turning long questions into badge overflow.
- Overview tab shows money made, user growth, viewer growth, and SMART-goal
  health cards plus an operating KPI board from `goals.md`.
- Products tab renders row-by-row and feels more like a product shop.
- Kanban lanes do not wrap into a two-column grid; lane header proof keeps all
  five lanes on the same y-axis in the browser check.
- Kanban card summary uses ticket/frontmatter metadata; modal displays full
  ticket body read-only for filesystem tickets.
- Timeline tab appears and renders project history/decision events when memory
  files exist.
- Config tab is no longer visible.
- Focused format/lint/tests/build and browser evidence pass.

## State
- `next_action:` review the Overview/Goals/Distribution/Members split against
  `tickets/TASK-0024/design.md`.
- `blocked:` false
- `latest_verification:` 2026-07-01; focused Team Workspace Biome check,
  focused goal/social/team-panel tests, and browser proof through `/office`
  passed for Overview, Goals, Distribution, Members, and mobile Distribution.
  Full `npm run ui:typecheck` remains blocked by existing repo-wide TypeScript
  debt outside this change.
- `result:` implemented; ready for review.

## Links
- `artifacts:`
  - `tickets/TASK-0024/design.md`
  - `.farplane/proof/team-panel-goals-distribution-2026-07-01/overview.png`
  - `.farplane/proof/team-panel-goals-distribution-2026-07-01/goals.png`
  - `.farplane/proof/team-panel-goals-distribution-2026-07-01/distribution.png`
  - `.farplane/proof/team-panel-goals-distribution-2026-07-01/members.png`
  - `.farplane/proof/team-panel-goals-distribution-2026-07-01/mobile-distribution.png`
  - `.farplane/proof/TASK-0024-farplane-overview-tabs.png`
  - `.farplane/proof/TASK-0024-farplane-goals-wrap.png`
  - `.farplane/proof/TASK-0024-farplane-products-rows.png`
  - `.farplane/proof/TASK-0024-farplane-kanban-frontmatter.png`
  - `.farplane/proof/TASK-0024-farplane-kanban-ticket-detail.png`
  - `.farplane/proof/TASK-0024-farplane-timeline-events.png`
  - `.farplane/proof/TASK-0024-impl-overview-kpi.png`
  - `.farplane/proof/TASK-0024-impl-goals-kpi-dashboard.png`
  - `.farplane/proof/TASK-0024-impl-products-shop.png`
  - `.farplane/proof/TASK-0024-impl-kanban-horizontal.png`
- `refs:`
  - `docs/features/FEAT-0001-operator-intelligence-modules-roadmap.md`
  - `tickets/building/TKT-037-team-panel-artifact-renderers/ticket.md`

## Notes
- `Products next-game layer:` keep the row layout, then add compact rank,
  artifact/proof trophy, current quest, and recent signal columns instead of
  more cards. The row should feel like a strategy-game mission ledger, not an
  XP economy detached from real product evidence.
- `KPI provider gap:` Overview/Goals now expose `provider_missing` honestly.
  The next real step is binding revenue/users/viewers providers or
  interval-written metric snapshots rather than inventing numbers in UI.
- `Kanban layout tradeoff:` lanes now stay in one horizontal strip with
  readable lane widths. On the current panel viewport, Done can require
  horizontal scrolling.
- `Browser proof caveat:` headless browser needed ANGLE SwiftShader flags to
  render the office scene. Existing 502 resource noise was still present, but
  the Team Panel assertions and screenshots completed.
