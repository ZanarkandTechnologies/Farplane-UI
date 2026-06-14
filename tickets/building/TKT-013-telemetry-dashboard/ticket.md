---
id: TKT-013
title: Telemetry dashboard and raw event views
state: building
owner: Farplane UI
source_ticket: tickets/todo/TKT-013-telemetry-bento-dashboard.md
created_at: 2026-06-13
---

# TKT-013: Telemetry Dashboard and Raw Event Views

## Status

- state: `building`
- owner: Farplane UI
- assignee: codex
- dependencies: `TKT-010`, `TKT-012`
- location: `tickets/building/TKT-013-telemetry-dashboard`
- enter when: the operator confirms the current telemetry surface is not the expected dashboard
- leave when: telemetry has a charted dashboard view, a raw telemetry inspection view, Aikage/Console metric parity for the core runtime insights, and browser proof for both global and team scopes
- blockers: none
- spawned follow-ups:
  - TKT-013 revision: replace custom SVG stopgap charts with Recharts/shadcn chart primitives and restore Aikage/Console dashboard metrics
- complexity: `M`

## Summary

The current Telemetry panel shows metric cards and tables, but it is not yet the
dashboard expected from the Aikage/Sigmax telemetry precedent. The operator has
seen only cards plus `Projects`, `Teams`, `Days`, and `Turns`; there are no real
charts, no dedicated raw telemetry lane, and no clear dashboard/raw separation.

Build the missing dashboard experience while preserving the existing telemetry
query/reducer semantics from TKT-010: duration math remains shared, suspicious
long turns stay filterable, and raw assistant output/transcripts must never be
shown.

2026-06-14 revision: the first implementation restored the basic
dashboard/raw split, but it is not yet equivalent to the older Aikage /
Farplane-Console telemetry dashboard. The active ticket remains open for the
parity pass.

## Scope

- In scope:
  - Add a first-class `Dashboard` tab to global Telemetry.
  - Add at least two real charted dashboard views, such as agent-hours trend,
    completed-turn trend, project/team contribution, source mix, or anomaly
    counts.
  - Add a `Raw Telemetry` tab for paged turn/event inspection with status,
    source/confidence, duration, project/team, and last-seen data.
  - Preserve supporting `Projects` and `Teams` tables.
  - Reuse the same dashboard/raw split inside Team Panel telemetry, scoped to
    the active project/team.
  - Keep the duration-cap/filtered-turn confidence state visible in summary
    metrics and raw rows.
  - Use Farplane shadcn-style primitives, theme tokens, and dense operational
    dashboard layout.
  - Use Recharts/shadcn chart primitives for standard dashboard charts instead
    of custom one-off SVG chart components.
  - Restore Aikage/Console-derived runtime insights: today/yesterday/30d agent
    hours, hourly source map, 7d/30d heatmap range, project breadth, parallel
    sessions/projects, daily capacity, longest-turn trend, availability, and
    scoped contribution/activity filtering.
- Out of scope:
  - Importing old Aikage/Farplane-Console UI components wholesale.
  - Building alerting, nudges, Telegram notifications, or retention policy.
  - Showing raw assistant output or transcripts.
  - Replacing TKT-010 telemetry ingestion/storage unless chart data needs a
    small derived-query extension.

## Delta

### Before

- Global Telemetry has metric cards and table/progress tabs.
- `Days` is a progress-list approximation rather than a charted dashboard.
- Turns pagination and duration caps exist, but they live under `Turns`, not a
  broader raw telemetry workflow.
- The screenshot evidence shows no charted view and no `Dashboard` or
  `Raw Telemetry` tab.

### After

- Global Telemetry opens on `Dashboard`, with charted runtime shape and anomaly
  health visible without switching into raw rows.
- `Raw Telemetry` is a separate tab for inspection/debugging: paged rows,
  status/source filters, duration cap, filtered/open/unmatched state, and
  confidence labels.
- Team Telemetry mirrors the same dashboard/raw pattern with scoped data.
- Existing `Projects` and `Teams` tables stay available as supporting tabs.

### Example

```text
Telemetry
Controls: 30 days | Cap 4h | source/all | status/all
Tabs: Dashboard | Projects | Teams | Raw Telemetry

Dashboard:
  Agent-hours trend chart
  Completed-turn bars
  Top project/team contribution chart
  Source/anomaly health cards

Raw Telemetry:
  Paged turns/events table
  Status: completed | filtered | open | unmatched
  Source: stop hook | next start | over cap | diagnostic
```

## Map

- Current UI: `ui/src/modules/telemetry/telemetry-dashboard-content.tsx`
- Team wrapper: `ui/src/modules/team-workspace/components/telemetry-tab.tsx`
- Shared reducer/query: `convex/modules/runtimeTelemetry/runtimeTelemetry.ts`
- Convex query entrypoints: `convex/modules/runtimeTelemetry/telemetry.ts`
- Validators: `convex/modules/runtimeTelemetry/validators.ts`
- Tests: `convex/modules/runtimeTelemetry/runtimeTelemetry.test.ts`
- Existing source ticket: `tickets/todo/TKT-013-telemetry-bento-dashboard.md`
- Screenshot evidence: `artifacts/evidence/current-telemetry-no-charts.png`
- Aikage parity gap: `artifacts/research/aikage-telemetry-gap.md`
- Implementation plan: `plan.md`

## Done / Proof

- [x] Global Telemetry includes a `Dashboard` tab.
- [x] Global Telemetry includes a `Raw Telemetry` tab.
- [x] Dashboard tab includes at least two real charted views built from telemetry data.
- [x] Raw Telemetry tab includes paged inspection rows and source/confidence labels.
- [x] Duration-cap/filtered-turn state remains visible and does not inflate counted agent hours.
- [x] Team Telemetry uses the same dashboard/raw component pattern with scoped data.
- [x] Existing project/team summaries remain available.
- [x] No raw assistant output or transcripts are exposed.
- [x] Focused telemetry reducer/query tests pass.
- [x] Focused UI lint/typecheck or documented pre-existing workspace failures are recorded.
- [x] Browser evidence is captured for global dashboard, global raw telemetry, team dashboard, and team raw telemetry.

## Revision Done / Proof

- [ ] Add `recharts` to the Farplane UI workspace and introduce/port a shadcn-style `ChartContainer` / `ChartTooltip` wrapper.
- [ ] Replace custom telemetry SVG charts with Recharts components for line, bar, and reference-line charts.
- [ ] Extend `TelemetrySummary` with Aikage/Console parity fields: `agentHourSummary`, `hourlyBuckets`, `parallelCapacity`, availability/covered-hours, longest-turn metadata, and day-scoped project/team breakdowns.
- [ ] Restore metric strip fields: Today, Delta vs yesterday, 30d total, Capacity, Availability, Peak parallel, Projects, Longest turn.
- [ ] Restore chart modes or equivalent dense dashboard sections: Agent-hours, Capacity, Source map, Parallel, Projects, Longest, Availability.
- [ ] Restore 7d/30d chart range controls independent of the raw query range where useful.
- [ ] Restore project breadth and parallel capacity calculations from completed turn intervals, respecting duration-cap filtering.
- [ ] Restore hourly source-map buckets for the last 24h.
- [ ] Preserve raw telemetry pagination, status/source filters, and privacy boundary.
- [ ] Capture browser proof showing the Recharts dashboard and the Aikage-parity metrics in global and team scopes.

## Agent Contract

- Open: this ticket, `program.md`, `progress.md`, the existing source ticket,
  current telemetry UI/reducer/query files, `PROJECT_RULES.md`, module
  `AGENTS.md`, `docs/TASTE.md`, and `qa/README.md`.
- Stabilize: preserve existing telemetry ingestion and duration semantics unless
  a small derived shape is needed for charts.
- Test hook: focused reducer tests first, then focused UI lint/build checks, then
  browser QA.
- Key screens/states: global Telemetry dashboard, global Raw Telemetry, Team
  Panel telemetry dashboard, Team Panel raw telemetry, empty/no-Convex state,
  filtered-duration state.
- Review focus: chart data correctness, dashboard/raw information architecture,
  dense operational taste, privacy boundary, and no duplicate runtime-cost
  semantics.

## Evidence Checklist

- [x] Screenshot: global Telemetry `Dashboard`.
- [x] Screenshot: global Telemetry `Raw Telemetry`.
- [x] Screenshot: Team Telemetry `Dashboard`.
- [x] Screenshot: Team Telemetry `Raw Telemetry`.
- [x] Snapshot: focused telemetry tests.
- [x] Snapshot: focused lint/typecheck/build result or documented pre-existing blockers.
- [x] QA note linking screenshots and observed route/actions.

## Notes

- The current screenshot is evidence of the gap, not completion evidence.
- The existing source ticket remains in `tickets/todo/` as historical source;
  this Goal Packet is the active build contract for completing the dashboard.
- Source-size note: `ui/src/modules/telemetry/telemetry-dashboard-views.tsx`
  is 544 raw lines after extracting the visual dashboard and raw-table views.
  Split plan if it grows further: move chart primitives to
  `telemetry-dashboard-charts.tsx` and raw inspection controls to
  `telemetry-raw-table.tsx`.
- Completion QA is recorded in `artifacts/qa/telemetry-dashboard-qa.md`.
