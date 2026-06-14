# TKT-013: Telemetry Dashboard and Raw Event Views

## Status

- state: `todo`
- owner: Farplane UI
- assignee:
- dependencies: TKT-010, TKT-012
- location: `tickets/todo/TKT-013-telemetry-bento-dashboard.md`
- active goal packet: `tickets/building/TKT-013-telemetry-dashboard/ticket.md`
- enter when: telemetry has real imported data and the current tabbed table UI is not enough to explain runtime health
- leave when: telemetry has a charted dashboard view, a raw telemetry inspection view, and browser proof for both global and team scopes
- blockers:
- spawned follow-ups:
- complexity: `M`

## Summary

This file is the historical source ticket. Active execution now lives in
`tickets/building/TKT-013-telemetry-dashboard/`.

The current telemetry surface is useful for tables and basic totals, but it is
not yet the dashboard we expected from the Aikage/Sigmax telemetry precedent.
There are no real charts, the global view does not separate overview analysis
from raw event inspection, and lifecycle anomalies are still mixed into the same
operator flow as project/team summaries.

## Delta

### Before

- Global Telemetry has metric cards plus `Projects`, `Teams`, `Days`, and
  `Turns` table/progress views.
- `Days` is a progress-list approximation, not a charted dashboard.
- Raw lifecycle rows/events are not exposed as their own operator view.
- Suspicious long turns can be filtered, but the UI does not yet make the
  confidence story visually obvious across trends and raw rows.

### After

- Global Telemetry has a first-class `Dashboard` tab with charted runtime shape:
  agent-hours trend, completed-turn trend, project/team contribution, source
  health, and lifecycle anomaly counts.
- Global Telemetry has a `Raw Telemetry` tab for event/turn inspection with
  pagination, duration-cap state, source labels, and anomaly filters.
- Project/team tables remain available, but they are supporting views rather
  than the main dashboard.
- Team Telemetry reuses the same dashboard/raw split while scoped to the active
  project/team.

### Example

```text
Telemetry
Controls: 30 days | Cap 4h | source/all | status/all
Tabs: Dashboard | Projects | Teams | Raw Telemetry

Dashboard:
  Agent-hours line/area chart
  Completed-turn bars
  Top projects/teams contribution chart
  Source health/anomaly cards

Raw Telemetry:
  Paged turns/events table
  Status: completed | filtered | open | unmatched
  Source: stop hook | next start | over cap | diagnostic
```

## Scope

- Directory: `ui/src/modules/telemetry`.
- Global view: charted dashboard, project/team tables, raw telemetry table.
- Team view: scoped charted dashboard plus raw telemetry/diagnostics.
- Add or extend shared reducer/query output only where the chart needs a stable
  derived shape; keep lifecycle math in `convex/modules/runtimeTelemetry`.
- The raw telemetry tab may show lifecycle metadata and bounded prompt excerpts
  only if already allowed by TKT-010/TKT-012 privacy rules; never show raw
  assistant output or transcripts.
- Do not create a second telemetry entrypoint or theme-panel refresh.

## UI Sketch

```text
Telemetry
+ Agent Hours + Completed Turns + Filtered Turns + Open Turns + Pings +
Tabs: Dashboard | Projects | Teams | Raw Telemetry

Dashboard
+ Runtime trend chart          + Completed turns chart       +
+ Project contribution chart   + Source/anomaly health       +

Raw Telemetry
+ Status filters + Source filters + Duration cap +
+ Paged turns/events table with source/confidence labels +
```

## Agent Contract

- Open: office speed dial/command palette -> Telemetry; Team Panel -> Telemetry tab.
- Test hook: `npx convex run modules/runtimeTelemetry/telemetry:getTelemetryDashboard '{"rangeDays":14}'`.
- Stabilize: use imported telemetry rows from TKT-012.
- Inspect: DOM text and screenshots for `Dashboard`, `Raw Telemetry`, chart labels, tab labels, source-health state, and duration-cap state.
- Key screens/states: global dashboard, global raw telemetry, team dashboard, team raw telemetry, empty/no-Convex state.
- QA cookbook: `qa/README.md` plus ticket-specific QA note if browser proof is captured.
- Taste refs: existing Farplane/shadcn dashboard primitives; no marketing hero; dense operational charts, not decorative bento filler.
- Expected artifacts: desktop screenshots for global dashboard, global raw telemetry, team dashboard, and team raw telemetry.
- Delegate with: this ticket and `docs/specs/FP01-operator-intelligence-modules-roadmap.md`.

## Done / Proof

- [ ] Current telemetry tables remain intact under supporting tabs.
- [ ] `Dashboard` tab exists in global telemetry and includes at least two real charted views.
- [ ] `Raw Telemetry` tab exists in global telemetry and separates raw/event inspection from summary dashboard work.
- [ ] Team telemetry uses the same dashboard/raw pattern with scoped data.
- [ ] Duration-cap/filtered-turn confidence state is visible in dashboard metrics and raw rows.
- [ ] Focused telemetry tests pass.
- [ ] Browser screenshot evidence is linked for dashboard and raw telemetry views.
