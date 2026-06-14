---
title: Telemetry Dashboard QA
ticket: tickets/building/TKT-013-telemetry-dashboard/ticket.md
created_at: 2026-06-13
updated_at: 2026-06-14
---

# Telemetry Dashboard QA

## Verdict

Pass with documented residual workspace issues. TKT-013 now has a Recharts-backed
Telemetry `Dashboard` tab, a separate `Raw Telemetry` tab, scoped Team
Telemetry parity, duration-cap confidence controls, Aikage/Console-derived
runtime metrics, a compact ticker-style metric rail, and browser evidence for
the required global/team/dashboard/raw/dropdown states.

## Browser Evidence

- Global dashboard:
  `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/global-dashboard-playwright.png`
- Global raw telemetry:
  `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/global-raw-telemetry-playwright.png`
- Team dashboard:
  `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/team-dashboard-playwright.png`
- Team raw telemetry:
  `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/team-raw-telemetry-playwright.png`
- Recharts revision captures:
  `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-global-dashboard.png`,
  `telemetry-global-raw.png`, `telemetry-team-dashboard.png`,
  `telemetry-team-raw.png`
- Ticker/overlay revision captures:
  `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-ticker-dashboard.png`,
  `telemetry-ticker-raw.png`, `telemetry-range-dropdown-open.png`,
  `telemetry-cap-dropdown-open.png`,
  `telemetry-contribution-dropdown-open.png`,
  `telemetry-raw-status-dropdown-open.png`
- No-scroll follow-up captures:
  `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-no-scroll-dashboard.png`,
  `telemetry-view-dropdown-raw.png`
- Heatmap restoration captures:
  `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-source-heatmap-final.png`,
  `telemetry-availability-heatmap-final.png`
- Final ticker loop capture:
  `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/screenshots/telemetry-ticker-loop-final.png`
- Agent-browser companion captures:
  `global-dashboard.png`, `global-raw-telemetry.png`, `team-dashboard.png`,
  `team-raw-telemetry.png`
- Console capture:
  `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/console.txt`
- Error capture:
  `tickets/building/TKT-013-telemetry-dashboard/artifacts/qa/errors.txt`

## Observed Flow

- Opened `/office` against the local Vite server at `127.0.0.1:5173`.
- Opened the global Telemetry panel through the QA helper.
- Verified the default global `Dashboard` tab renders the Recharts chart area,
  lifecycle health bars, contribution scope control, and metric strip entries
  for Today, 30d total, Capacity, Peak parallel, Today breadth, Availability,
  Longest, Filtered, and Pings.
- Switched to `Raw Telemetry` and verified raw inspection filters, paged turns,
  duration/source labels, and source values such as `diagnostic`, `next start`,
  and `stop hook`.
- Opened Team Workspace, selected Telemetry, and verified both `Dashboard` and
  `Raw Telemetry` tabs in the scoped team view.
- Browser assertion after the Recharts revision found one visible
  `.recharts-wrapper`, one `Contribution scope` selector, `All days` scope text,
  and no `Database is not defined` reference error.
- Browser assertion after the ticker/overlay revision found a compact
  telemetry ticker, a larger first-viewport chart area, paged raw telemetry text,
  and no telemetry `ReferenceError`s.
- Opened range, duration cap, contribution scope, and raw status dropdowns in
  the telemetry modal. Each select content node rendered at `zIndex: 9999`,
  `opacity: 1`, and `visibility: visible`.
- No-scroll follow-up measured the Dashboard view at `scrollAreas: 0`,
  `bodyOverflow: false`, `tickerHeight: 44`, and `chartHeight: 402.5` in a
  1600x900 browser viewport. The telemetry tabs were no longer present, and the
  `Telemetry view` dropdown switched to Raw Telemetry with paged rows visible.
- Heatmap restoration verified the Source map mode renders 24 activity heat
  cells and the Availability mode renders 24 covered/missing/pending status
  cells. Browser QA also verified correct active chart mode state, zero nested
  dashboard scroll areas, no body overflow, and no telemetry ReferenceErrors.
- Final ticker QA verified the ticker uses 3 repeated metric groups, a 3564px
  animated track against a 1262px visible viewport, active
  `telemetry-ticker-scroll`, changing transform over time, and no telemetry
  ReferenceErrors.

## Command Evidence

- `npx biome lint ui/src/components/ui/chart.tsx ui/src/modules/telemetry/telemetry-dashboard-content.tsx ui/src/modules/telemetry/components/telemetry-dashboard-views.tsx ui/src/modules/telemetry/components/telemetry-dashboard-recharts.tsx ui/src/modules/telemetry/telemetry-dashboard-types.ts convex/modules/runtimeTelemetry/runtimeTelemetry.ts convex/modules/runtimeTelemetry/telemetry.ts convex/modules/runtimeTelemetry/validators.ts convex/modules/runtimeTelemetry/runtimeTelemetry.test.ts`
  passed.
- `npm run test:once -- convex/modules/runtimeTelemetry` passed with 9 tests.
- `npm run typecheck:root` passed.
- `npm run --workspace @farplane/ui typecheck -- --pretty false` exits `2`
  from pre-existing workspace-wide UI debt; filtering the output for
  `telemetry`, `runtimeTelemetry`, `components/ui/chart`, and `recharts`
  produced no matching errors.
- `npm run ui:build` passed.
- `git diff --check -- ui/src/modules/telemetry convex/modules/runtimeTelemetry tickets/building/TKT-013-telemetry-dashboard`
  passed before this QA note; rerun after ticket writeback before final closeout.
- Ticker/overlay revision focused lint:
  `npx biome lint ui/src/components/ui/select.tsx ui/src/components/ui/popover.tsx ui/src/modules/telemetry/telemetry-dashboard-content.tsx ui/src/modules/telemetry/components/telemetry-dashboard-views.tsx ui/src/modules/telemetry/components/telemetry-dashboard-recharts.tsx`
  passed.
- Ticker/overlay revision `npm run typecheck:root` passed.
- Ticker/overlay revision `npm run ui:build` passed.
- Ticker/overlay revision `git diff --check -- ui/src/components/ui/select.tsx ui/src/components/ui/popover.tsx ui/src/styles.css ui/src/modules/telemetry/telemetry-dashboard-content.tsx ui/src/modules/telemetry/components/telemetry-dashboard-views.tsx ui/src/modules/telemetry/components/telemetry-dashboard-recharts.tsx tickets/building/TKT-013-telemetry-dashboard`
  passed before QA note writeback.
- Accessibility-label probe verified the top telemetry range and duration-cap
  triggers expose `Telemetry range` and `Duration cap filter` names; the
  contribution scope trigger exposes `Contribution scope`.
- Heatmap restoration `npm run test:once -- convex/modules/runtimeTelemetry`
  passed with 9 tests.
- Heatmap restoration focused Biome lint passed for
  `convex/modules/runtimeTelemetry/runtimeTelemetry.ts`,
  `convex/modules/runtimeTelemetry/runtimeTelemetry.test.ts`,
  `ui/src/modules/telemetry/telemetry-dashboard-types.ts`, and
  `ui/src/modules/telemetry/components/telemetry-dashboard-recharts.tsx`.
- Heatmap restoration `npm run typecheck:root` passed.
- Heatmap restoration `npm run ui:build` passed.
- Final modularity pass focused Biome lint passed for telemetry dashboard
  content/views/Recharts, the extracted ticker, and module CSS.
- Final modularity pass `npm run quality:smells` passed with existing large-file
  warnings.
- Final modularity pass `bash scripts/pre_push_check.sh` completed: required
  code smell, root build/typecheck, and UI production build passed; advisory
  lint/tests and codex agent review passed; advisory full typecheck still fails
  from pre-existing workspace-wide UI issues outside telemetry.

## Residuals

- Full `npm run typecheck` still fails from pre-existing workspace-wide UI debt
  unrelated to this telemetry slice, including missing UI/runtime dependencies,
  JSX namespace issues, office model type drift, and existing module export
  mismatches.
- Headless browser QA logs one office-scene WebGL failure:
  `Error creating WebGL context`. The captured telemetry panels still rendered
  and the error is from the office Three.js renderer path, not from the
  Telemetry module.
