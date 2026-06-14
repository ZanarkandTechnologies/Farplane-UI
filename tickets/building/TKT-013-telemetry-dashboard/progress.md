---
title: TKT-013 Progress
ticket: tickets/building/TKT-013-telemetry-dashboard/ticket.md
created_at: 2026-06-13
---

# TKT-013 Progress

## Log

### 2026-06-13 Goal Packet Created

- trigger: operator requested `$goal-advisor` after seeing the current telemetry panel screenshot
- intent: turn the missing telemetry dashboard/raw telemetry work into a native Goal Packet
- observed gap:
  - screenshot shows metric cards plus `Projects`, `Teams`, `Days`, and `Turns`
  - no charted dashboard views are visible
  - no dedicated raw telemetry tab is visible
  - existing filtered-duration state is present but not part of a broader confidence dashboard
- actions:
  - copied screenshot evidence into ticket artifacts
  - created `ticket.md`, `program.md`, `progress.md`, and generated native Goal prompt
  - bound the Goal to existing TKT-013 source ticket and telemetry module files
- files/artifacts:
  - `tickets/building/TKT-013-telemetry-dashboard/ticket.md`
  - `tickets/building/TKT-013-telemetry-dashboard/program.md`
  - `tickets/building/TKT-013-telemetry-dashboard/progress.md`
  - `tickets/building/TKT-013-telemetry-dashboard/generated-goal-prompt.md`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/evidence/current-telemetry-no-charts.png`
- metric sample: Goal Packet exists; implementation not started in this packet
- drift verdict: aligned with operator correction that telemetry is not fully implemented
- next_action: start native Goal execution from generated prompt
- blockers: none

### 2026-06-14 Telemetry Component Boundary Pass

- trigger: operator asked for a dedicated `telemetry/components` boundary before
  committing telemetry changes
- actions:
  - moved telemetry-only presentation files into
    `ui/src/modules/telemetry/components/`
  - added `ui/src/modules/telemetry/components/README.md`
  - updated telemetry module README/AGENTS with the component placement rule
  - kept shadcn-style primitives global because they are shared UI
    infrastructure, including the modal-safe dropdown layering fix
- next_action: rerun focused checks, pre-push, commit, and push
- blockers: none

### 2026-06-13 Goal Execution Complete

- trigger: native Goal execution for TKT-013
- actions:
  - fixed the Telemetry metric-grid runtime crash by preserving the `Database`
    icon import path inside the extracted view layer
  - extracted telemetry DTO types into
    `ui/src/modules/telemetry/telemetry-dashboard-types.ts`
  - moved dashboard cards, chart views, breakdown tables, and raw telemetry
    inspection UI into
    `ui/src/modules/telemetry/components/telemetry-dashboard-views.tsx`
  - updated `telemetry-dashboard-content.tsx` so the top-level tabs are
    `Dashboard`, `Projects`, `Teams`, and `Raw Telemetry`
  - preserved the 4h default duration cap, cap selector, filtered durations,
    pagination, and scoped global/team query args
  - verified global and team telemetry browser states and recorded screenshots
- proof:
  - focused telemetry lint passed
  - runtime telemetry tests passed with 7 tests
  - root typecheck passed
  - focused UI typecheck filter found no telemetry/runtimeTelemetry errors
  - UI build passed
  - browser screenshots captured for global dashboard, global raw telemetry,
    team dashboard, and team raw telemetry
- residuals:
  - full workspace `npm run typecheck` still fails on unrelated pre-existing
    UI-wide debt
  - headless browser logs a WebGL context creation error from the office
    Three.js renderer; telemetry panels still render
- files/artifacts:
  - `ui/src/modules/telemetry/telemetry-dashboard-content.tsx`
  - `ui/src/modules/telemetry/telemetry-dashboard-types.ts`
  - `ui/src/modules/telemetry/components/telemetry-dashboard-views.tsx`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/telemetry-dashboard-qa.md`
- source-size note:
  - `telemetry-dashboard-views.tsx` is 544 raw lines; ticket notes include the
    split plan required by project rules if it grows further
- drift verdict: aligned; no dashboard/raw scope moved out of the Goal Packet
- next_action: final diff check and close native Goal
- blockers: none

### 2026-06-14 Aikage Parity Gap Reopened

- trigger: operator pointed out the new dashboard still lacks the older
  Aikage/Console chart richness and questioned the custom SVG chart stopgap
- evidence read:
  - Farplane UI package dependencies: no chart library currently installed
  - Farplane-Console package dependencies: `recharts@3.8.0`
  - Farplane-Console dashboard components and query reducers
  - Codexter Aikage telemetry sync spec
  - current Recharts, Chart.js/react-chartjs-2, and TanStack React Charts docs
- decision:
  - Recharts is the best fit for this pass because Console already uses it,
    it matches shadcn chart primitives, and the missing charts are standard
    dashboard charts
- gap:
  - current Farplane UI has only basic custom charts and raw telemetry
    separation
  - missing Aikage/Console fields include today/yesterday/30d summary, hourly
    source map, parallel capacity, project breadth, capacity, availability,
    longest-turn diagnostics, and day-scoped contribution/activity filtering
- actions:
  - added `artifacts/research/aikage-telemetry-gap.md`
  - expanded the active ticket with a revision checklist for Recharts and
    Aikage parity
- drift verdict: previous goal completed the narrow dashboard/raw split, but
  the active product expectation is broader; ticket remains open for revision
- next_action: implement Recharts-backed Aikage parity pass
- blockers: none

### 2026-06-14 Impl Plan Written

- trigger: operator requested `$impl-plan`, then Goal creation and execution
- actions:
  - read active ticket, gap artifact, project rules, PRD, module contracts,
    memory/troubles/lessons, current telemetry UI/reducer/tests, Console chart
    wrapper and dashboard references, and Goal prompt templates
  - noted missing `docs/specs/first-principles-planning.md` and missing
    `convex/_generated/ai/guidelines.md`; carried required first-principles
    and Convex constraints directly from repo/module contracts
  - wrote `tickets/building/TKT-013-telemetry-dashboard/plan.md`
  - updated `program.md` execution order for Recharts/Aikage parity
- decision:
  - keep the ticket whole as one build-and-proof loop; the dependency,
    reducer, UI, and browser proof are coupled enough that splitting would add
    coordination overhead without reducing proof risk
- plan review:
  - passed reference coverage, scope discipline, map usefulness, typed-flow,
    proof specificity, risk clarity, and gap grounding checks
- next_action: create native Goal and execute plan
- blockers: none

### 2026-06-14 Recharts/Aikage Parity Goal Executed

- trigger: native Goal run from the Recharts/Aikage parity plan
- actions:
  - installed `recharts@3.8.0` in the Farplane UI workspace
  - added a shadcn-style `ChartContainer` / `ChartTooltip` wrapper at
    `ui/src/components/ui/chart.tsx`
  - extended the runtime telemetry reducer with `agentHourSummary`,
    `hourlyBuckets`, `parallelCapacity`, day-scoped breakdown maps,
    availability/covered-hours, peak parallel metadata, and longest-turn
    metadata
  - added reducer coverage for hourly/capacity/availability fields and
    duration-cap-aware parallel capacity
  - replaced the telemetry dashboard chart area with Recharts-backed modes for
    agent-hours, capacity, source map, parallel, project breadth, longest turn,
    and availability
  - restored metric strip signals for Today, Delta vs yesterday, 30d total,
    Capacity, Peak parallel, Today breadth, Availability, Longest, Filtered,
    and Pings
  - added an `All days` / day-specific contribution scope selector backed by
    the day-scoped breakdown maps
  - preserved raw telemetry pagination, status/source filters, duration-cap
    filtering, and the no-transcript privacy boundary
- proof:
  - focused Biome lint passed for telemetry UI, chart wrapper, and runtime
    telemetry files
  - `npm run test:once -- convex/modules/runtimeTelemetry` passed with 9 tests
  - `npm run typecheck:root` passed
  - `npm run ui:build` passed
  - UI package typecheck still exits `2`, but filtering for telemetry,
    runtimeTelemetry, chart wrapper, and Recharts paths produced no matching
    errors
  - browser QA opened `/office`, global Telemetry, Team Workspace Telemetry,
    dashboard/raw tabs, and verified raw pagination as
    `Page 1 of 63 / 1558 turns`
  - browser assertion verified one Recharts wrapper, one contribution scope
    selector, `All days` scope text, and no `Database is not defined`
    reference error
- artifacts:
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/telemetry-dashboard-qa.md`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-global-dashboard.png`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-global-raw.png`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-team-dashboard.png`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-team-raw.png`
- residuals:
  - headless browser QA still logs the existing office Three.js WebGL context
    failure; telemetry panels render despite it
  - full UI package typecheck remains blocked by unrelated workspace-wide type
    debt
  - `convex/_generated/ai/guidelines.md` is absent, so Convex work followed
    module-local contracts and focused reducer tests
- drift verdict: aligned with operator correction; the parity pass now uses
  Recharts instead of custom SVG charting and restores the core Aikage/Console
  runtime telemetry signals
- next_action: final diff check, stop dev server, and close native Goal
- blockers: none

### 2026-06-14 Ticker Layout / Modal Overlay Revision

- trigger: operator correction that telemetry charts were still visually
  crowded and modal dropdowns were not usable
- actions:
  - replaced the metric card grid with a compact market-tape ticker rail that
    preserves Today, 30d total, Capacity, Peak parallel, Today breadth,
    Availability, Longest, Filtered, and Pings
  - tightened the telemetry header and tabs so the dashboard chart becomes the
    primary first-viewport surface
  - increased Recharts panel height and compacted chart header/rail chrome
  - added CSS ticker motion with hover/focus pause and reduced-motion opt out
  - raised shared Select and Popover portal content to `z-[9999]` and forced
    open content opacity to avoid invisible modal dropdowns
  - added explicit accessible names to the top telemetry range and duration-cap
    select triggers
- proof:
  - focused Biome lint passed for telemetry views/content/Recharts and changed
    UI primitives
  - `npm run typecheck:root` passed
  - `npm run ui:build` passed
  - `git diff --check` passed for telemetry, changed primitives, styles, and
    TKT-013 artifacts
  - browser QA captured the ticker dashboard and raw telemetry views
  - browser QA opened range, duration cap, contribution scope, and raw status
    dropdowns; all select content reported `zIndex: 9999`, `opacity: 1`, and
    no telemetry ReferenceErrors
- artifacts:
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-ticker-dashboard.png`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-ticker-raw.png`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-range-dropdown-open.png`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-cap-dropdown-open.png`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-contribution-dropdown-open.png`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-raw-status-dropdown-open.png`
- residuals:
  - headless browser QA still logs the existing office Three.js WebGL context
    failure; telemetry panels render despite it
  - top range/cap select labels were verified separately after the dropdown
    layer proof
- drift verdict: aligned with the requested ASCII/ticker design direction and
  modal layering fix
- next_action: close out after final status check
- blockers: none

### 2026-06-14 No-Scroll Dashboard Follow-Up

- trigger: operator feedback that the dashboard should not need tab-internal
  scrolling and the ticker should use smaller two-line metrics
- actions:
  - replaced the telemetry tab strip with a compact `Telemetry view` dropdown
  - removed the Dashboard view's nested `ScrollArea`
  - changed the chart panel to a flex/grid fill-height layout so the graph uses
    the remaining modal height
  - compacted the ticker into two-line metric cells
  - constrained the right contribution rail to avoid half-clipped rows
  - added a project UI standard to avoid nested scrolling in modal dashboards
    when compact controls and fill-height layouts can work instead
- proof:
  - browser QA reported `scrollAreas: 0`, `bodyOverflow: false`,
    `tickerHeight: 44`, and no telemetry ReferenceErrors
  - browser QA verified the `Telemetry view` dropdown can switch to Raw
    Telemetry and that the old tab strip is gone
- artifacts:
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-no-scroll-dashboard.png`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-view-dropdown-raw.png`
- next_action: run final lint/typecheck/build
- blockers: none

### 2026-06-14 Heatmap Chart Restoration

- trigger: operator noted the older telemetry dashboard had heatmap-style
  activity and availability views rather than only line/bar charts
- actions:
  - added `availabilityHours` to the runtime telemetry summary contract
  - derived 24 local-hour availability cells for today from telemetry ping
    coverage
  - represented availability hours as `covered`, `missing`, or `pending`
  - replaced the Source map bar chart with a 24-hour activity intensity heatmap
  - replaced the Availability bar chart with a website-status-style hourly
    heatmap and compact status counters
- proof:
  - `npm run test:once -- convex/modules/runtimeTelemetry` passed with 9 tests
  - focused Biome lint passed for the reducer, reducer test, telemetry types,
    and Recharts dashboard view
  - `npm run typecheck:root` passed
  - `npm run ui:build` passed
  - browser QA verified 24 Source map heat cells, 24 Availability cells, correct
    active mode states, no nested dashboard scroll areas, no body overflow, and
    no telemetry ReferenceErrors
- artifacts:
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-source-heatmap-final.png`
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-availability-heatmap-final.png`
- next_action: final status check
- blockers: none

### 2026-06-14 Final Ticker / Modularity / Pre-Push Pass

- trigger: operator noted the ticker did not look continuously looping and asked
  for telemetry-local components plus modularity/precommit checks
- actions:
  - moved ticker animation CSS from global `ui/src/styles.css` into
    `ui/src/modules/telemetry/components/telemetry-dashboard.css`
  - extracted the ticker component into
    `ui/src/modules/telemetry/components/telemetry-metric-ticker.tsx`
  - changed ticker rendering from two repeated metric groups to three repeated
    groups and changed the animation travel from `-50%` to `-33.3333%`
  - kept the generic shadcn-style chart primitive in `ui/src/components/ui`
    because it is a reusable chart wrapper, while telemetry-specific chart
    implementations remain in the telemetry module
- proof:
  - focused Biome lint passed for telemetry dashboard content/views/Recharts,
    the extracted ticker, and module CSS
  - `npm run quality:smells` passed with existing large-file warnings
  - `npm run typecheck:root` passed
  - `git diff --check` passed for telemetry/UI/runtime/ticket changes
  - `bash scripts/pre_push_check.sh` completed; required code smell,
    root build/typecheck, and UI production build passed; lint/tests passed;
    codex agent review passed; full typecheck remains advisory-failing on
    pre-existing workspace-wide UI errors outside telemetry
  - browser QA verified ticker has 3 repeated groups, track width 3564px against
    a 1262px visible ticker viewport, active `telemetry-ticker-scroll`
    animation, changing transform over time, and no telemetry ReferenceErrors
- artifacts:
  - `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-ticker-loop-final.png`
- residuals:
  - `convex/modules/runtimeTelemetry/runtimeTelemetry.ts` remains an existing
    oversized reducer at 1044 lines; safe split should be a targeted backend
    reducer extraction rather than a drive-by UI polish change
  - full UI workspace typecheck still has unrelated advisory failures already
    surfaced by pre-push
- blockers: none
