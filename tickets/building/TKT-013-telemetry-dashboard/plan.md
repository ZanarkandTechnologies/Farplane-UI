---
title: TKT-013 Implementation Plan
ticket: tickets/building/TKT-013-telemetry-dashboard/ticket.md
created_at: 2026-06-14
planner: impl-plan
---

# TKT-013 Implementation Plan

## Summary

Restore the Aikage/Farplane-Console telemetry dashboard shape inside Farplane
UI while preserving the current raw telemetry workflow and duration-confidence
rules. The work stays one build-and-proof loop: install Recharts, port the
shadcn chart wrapper, extend the Convex telemetry summary with derived parity
fields, replace the custom chart stopgap, and capture browser proof.

## Scope

- In scope:
  - Add Recharts to the UI workspace.
  - Add a Farplane UI chart wrapper equivalent to Console's shadcn/Recharts
    `ChartContainer`, `ChartTooltip`, and `ChartTooltipContent`.
  - Extend `buildTelemetrySummary` with Aikage/Console parity fields while
    preserving the existing 4h default cap and filtered-turn accounting.
  - Replace custom SVG/HTML chart primitives with Recharts views.
  - Restore the metric strip and dashboard views for agent-hours, capacity,
    source map, parallel capacity, project breadth, longest turn, and
    availability.
  - Keep global and team telemetry using the same component pattern and query
    args.
  - Preserve `Raw Telemetry` pagination, status/source filters, and privacy
    boundary.
- Out of scope:
  - Nudge/Telegram/learning inbox parity.
  - Importing Console components wholesale.
  - Replacing telemetry ingestion or Convex schema.
  - Exposing raw assistant output, transcripts, or full prompts.

## Delta

### Before

- Farplane UI has `Dashboard`, `Projects`, `Teams`, and `Raw Telemetry`.
- Dashboard charts are one-off SVG/HTML primitives.
- Query output has only aggregate totals, daily buckets, breakdowns, and paged
  turns.
- The UI cannot answer the operator questions about last-day/last-week
  parallel work capacity, project breadth, hourly stop concentration, daily
  capacity, availability, or longest-turn shape.

### After

- Farplane UI uses Recharts through a shared shadcn-style chart wrapper.
- Dashboard top metrics show Today, Delta, 30d total, Capacity, Availability,
  Peak parallel, Projects, Longest turn, plus confidence/filtered state.
- Dashboard has dense chart modes or sections for Agent-hours, Capacity,
  Source map, Parallel, Projects, Longest, and Availability.
- Query output carries parity fields derived from capped completed turns:
  `agentHourSummary`, `hourlyBuckets`, `parallelCapacity`, enriched
  `dailyBuckets`, and day-scoped breakdown maps.
- Raw telemetry remains a separate inspection lane with paging, filters, and
  source/confidence labels.

### Why Now

The first TKT-013 pass fixed the missing tab separation but did not restore the
older telemetry product value. The operator is explicitly trying to measure
parallel project capacity and confidence over recent days; the current thin
dashboard cannot answer that.

### First-Principles Basis

- Objective: make telemetry a decision surface for agent-hours, confidence,
  and parallel work capacity, not just a totals panel.
- Need: operators need to see whether multiple projects ran in parallel, which
  projects consumed time, and where stop-hook gaps make totals suspect.
- Root cause: current Farplane summary is narrower than the Console/Aikage
  query and UI contracts.
- Assumptions: imported telemetry rows already include enough lifecycle,
  project/team, machine/session, and received-at data to derive parity fields.
- Constraints: no raw transcripts, no ingestion redesign, no old component
  wholesale import, keep UI module-local boundaries, keep Convex reducers
  deterministic and testable.
- First viable slice: derive capped daily/hourly/parallel fields from existing
  `RuntimeTurn[]`, then render them with Recharts.
- Proof/falsification: reducer tests demonstrate derived fields and cap
  semantics; browser screenshots show Recharts dashboard and scoped team view.
- Tradeoff: add one chart dependency and a small shared chart wrapper instead
  of maintaining bespoke SVG primitives.
- Non-goals: learning inbox, Telegram nudges, retention policy, raw prompt
  review.

## Program

```text
vars:
  ticket = tickets/building/TKT-013-telemetry-dashboard/ticket.md
  reducer = convex/modules/runtimeTelemetry/runtimeTelemetry.ts
  ui = ui/src/modules/telemetry
  chart_wrapper = ui/src/components/ui/chart.tsx

program:
  install_recharts(ui/package.json) -> package_lock_delta
  port_chart_wrapper(Console chart.tsx) -> chart_wrapper
  extend_types(reducer, telemetry-dashboard-types.ts) -> parity_summary_shape
  derive_fields(rows, cap, timezone) -> daily/hourly/parallel/capacity/availability
  replace_charts(ui views) -> Recharts dashboard sections
  preserve_raw(ui views) -> raw tab unchanged except type compatibility
  verify(reducer tests, lint, typecheck/build, browser QA) -> evidence
  writeback(ticket, progress, qa report) -> completion state
```

## Map

```mermaid
flowchart TD
  A["runtimeTelemetryActivityPings rows"] --> B["runtimeTelemetry.ts / buildRuntimeTurns(rows): RuntimeTurn[]"]
  B --> C["applyTurnFilters(turns, maxTurnDurationMs): capped RuntimeTurn[]"]
  C --> D["buildTelemetrySummary(rows, options): TelemetrySummary"]
  D --> E["agentHourSummary<br/>today/yesterday/delta/30d"]
  D --> F["dailyBuckets<br/>hours, turns, projects, teams, availability, longest, peak"]
  D --> G["hourlyBuckets<br/>last 24h stop-hour source map"]
  D --> H["parallelCapacity<br/>peak sessions/projects per day"]
  D --> I["breakdownByDay + turnsPage"]
  E & F & G & H & I --> J["telemetry-dashboard-types.ts / UI DTO"]
  J --> K["TelemetryDashboardContent(query args): global/team scoped state"]
  K --> L["TelemetryDashboardView(Recharts): metric strip + chart modes"]
  K --> M["RawTelemetryTable: paged private diagnostics"]
```

Typed flow:

1. `ActivityPingRow[]` enters `buildTelemetrySummary`.
2. `RuntimeTurn[]` is inferred and capped; over-cap turns become `status:
   "filtered"` and do not count toward completed agent-hours.
3. `TelemetrySummary` returns enriched derived fields plus the existing
   `turnsPage`.
4. UI renders chart-only derived metadata in Dashboard and turn metadata in
   Raw Telemetry.

Touch:

- `ui/package.json`, `package-lock.json`
- `ui/src/components/ui/chart.tsx`
- `ui/src/modules/telemetry/telemetry-dashboard-types.ts`
- `ui/src/modules/telemetry/telemetry-dashboard-content.tsx`
- `ui/src/modules/telemetry/components/telemetry-dashboard-views.tsx`
- `convex/modules/runtimeTelemetry/runtimeTelemetry.ts`
- `convex/modules/runtimeTelemetry/runtimeTelemetry.test.ts`
- ticket/progress/QA artifacts

Inspect:

- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/src/components/ui/chart.tsx`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/src/features/dashboard/components/*`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/convex/dashboard.ts`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/convex/lib/parallelCapacity.ts`

## Done / Proof

- Mechanical:
  - `npm install` updates UI workspace dependency state cleanly.
  - `npm run test:once -- convex/modules/runtimeTelemetry` passes.
  - focused Biome lint passes on changed telemetry/chart files.
  - `npm run typecheck:root` passes.
  - focused UI typecheck filter has no telemetry/chart errors; full workspace
    debt is documented if still present.
  - `npm run ui:build` passes or any failure is proven unrelated.
  - `git diff --check` passes on touched paths.
- Browser proof:
  - global Telemetry dashboard screenshot with Recharts-backed parity views.
  - global Raw Telemetry screenshot proving raw workflow preserved.
  - team Telemetry dashboard screenshot with scoped parity views.
  - team Raw Telemetry screenshot proving scoped raw workflow preserved.
- Review focus:
  - Duration cap still excludes suspicious inferred turns from counted hours.
  - Parallel capacity uses completed positive-duration turn intervals only.
  - Hourly source map attributes hours to stop/recovered end hour.
  - Public mode still hides Raw Telemetry.
  - No raw assistant output/transcripts appear in modeled UI types or rendered
    rows.
- Hard gates:
  - No hidden chart globals.
  - No duplicate telemetry entrypoint.
  - No Console component wholesale import.
  - New source files over 500 raw lines get a ticket split note or are split.

## State

- Ready for implementation.
- `convex/_generated/ai/guidelines.md` is absent in this checkout; planning
  used the module-local Convex contract and existing reducer tests.
- Existing workspace has unrelated dirty files and known full typecheck debt;
  do not revert unrelated changes.

## Links

- Ticket: `tickets/building/TKT-013-telemetry-dashboard/ticket.md`
- Gap analysis: `tickets/building/TKT-013-telemetry-dashboard/artifacts/research/aikage-telemetry-gap.md`
- Program: `tickets/building/TKT-013-telemetry-dashboard/program.md`
- Progress: `tickets/building/TKT-013-telemetry-dashboard/progress.md`

## Notes

- Risk: deriving parallel capacity incorrectly would create misleading
  operator confidence. Contain by testing overlap with representative completed,
  filtered, open, and cross-day turns.
- Rollback: Recharts UI can be reverted to the current thin dashboard while
  keeping backend derived fields if the chart pass misbehaves.
- Plan review: passed impl-plan checks for reference coverage, coherent scope,
  map usefulness, typed flow, proof specificity, and risk clarity.

---

# 2026-06-14 Ticker Layout / Modal Overlay Revision

## Summary

Convert the telemetry dashboard from a card-heavy top section into a chart-first
operator console: compact title/controls, a one-line market-tape metric ticker,
then large Recharts content with a right health/contribution rail. Fix modal
dropdown layering through shared primitive z-index defaults so every select and
popover renders above dialog content.

## Scope

- In scope:
  - Replace the telemetry metric card grid with a compact horizontally scrolling
    ticker rail.
  - Preserve all current metric values and duration-confidence labels.
  - Reduce telemetry header/tabs vertical footprint so charts become the main
    viewport object.
  - Increase Recharts chart height and tighten chart chrome.
  - Keep raw telemetry usable with the same compact ticker/header.
  - Raise shared `SelectContent` / `PopoverContent` portal z-index above dialogs.
  - Document the overlay z-index rule in TKT-013 proof notes.
- Out of scope:
  - New telemetry data fields.
  - Replacing Radix primitives.
  - New animation libraries.
  - Reworking the office modal shell outside dropdown layering.

## Delta

### Before

- Nine metric cards consume two dashboard rows before the chart.
- Charts start below the fold on shorter modal viewports.
- Dropdown content uses `z-50`, the same layer as dialog content/overlay, so
  select menus can appear clipped or hidden in modal contexts.

### After

- Metrics render as a single compact ticker rail:
  `TODAY 0h -10h • 30D 294h • CAP 0% • PEAK 0S/0P • ...`
- The chart area starts immediately after tabs and owns the primary viewport.
- Chart mode buttons stay compact; 7d/30d controls remain near chart focus.
- Select and popover portal content use a shared high z-index above modal
  content.

### First-Principles Basis

- Objective: make telemetry readable as a dashboard, not a summary-card wall.
- Need: the operator wants charts to be the main surface while metrics remain
  glanceable.
- Root cause: the current metric grid reserves too much vertical space and
  modal overlay primitives share the dialog layer.
- Constraint: keep dense operational style and existing telemetry semantics.
- First viable slice: ticker rail + chart height + shared z-index primitive
  change.
- Proof: browser screenshot shows chart-first dashboard and opened selects above
  modal content.
- Tradeoff: marquee-style motion is implemented with CSS only and disabled for
  reduced-motion users.
- Non-goals: new chart types, new telemetry math, new modal system.

## Program

```text
vars:
  ui = ui/src/modules/telemetry
  primitives = ui/src/components/ui/select.tsx + popover.tsx

program:
  plan(ticker_layout, overlay_rule) -> ticket revision
  change(TelemetryMetricGrid) -> compact ticker rail
  change(TelemetryDashboardContent) -> reduced chrome and tighter tabs
  change(TelemetryDashboardView) -> taller chart, compact header, stable side rail
  change(SelectContent, PopoverContent) -> z-[9999] opacity-100 portal content
  verify(lint, root typecheck, ui build, browser modal dropdown proof) -> QA note
```

## Map

```mermaid
flowchart TD
  A["TelemetryDashboardContent"] --> B["compact header + controls"]
  A --> C["TelemetryMetricGrid(data): ticker rail"]
  A --> D["Tabs"]
  D --> E["TelemetryDashboardView(data): chart-first layout"]
  E --> F["Large Recharts panel"]
  E --> G["Lifecycle + contribution rail"]
  H["SelectContent / PopoverContent"] --> I["Portal z-[9999] above Dialog z-50"]
```

## Done / Proof

- [x] Metric grid is replaced by a compact ticker rail.
- [x] Dashboard chart appears in the first viewport with substantially more
      vertical room than the metric strip.
- [x] Ticker animation pauses on hover/focus and respects reduced motion.
- [x] Range, duration-cap, and contribution-scope dropdowns open above modal
      content.
- [x] Raw Telemetry remains paged and readable.
- [x] Focused telemetry/UI primitive lint passes.
- [x] `npm run typecheck:root` passes.
- [x] `npm run ui:build` passes.
- [x] Browser QA captures dashboard and dropdown-open evidence.

## Notes

- Shared overlay rule accepted for this pass:
  `dialog/overlay = z-50`, `select/popover portal content = z-[9999]`.
  A later design-system ticket can replace these literals with named Tailwind
  tokens if the project introduces a theme z-index scale.
- The Radix animation utility classes were removed from select/popover content
  because the modal path could leave open content at computed `opacity: 0`.
