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
runtime metrics, and browser evidence for the required global and team states.

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

## Command Evidence

- `npx biome lint ui/src/components/ui/chart.tsx ui/src/modules/telemetry/telemetry-dashboard-content.tsx ui/src/modules/telemetry/telemetry-dashboard-views.tsx ui/src/modules/telemetry/telemetry-dashboard-recharts.tsx ui/src/modules/telemetry/telemetry-dashboard-types.ts convex/modules/runtimeTelemetry/runtimeTelemetry.ts convex/modules/runtimeTelemetry/telemetry.ts convex/modules/runtimeTelemetry/validators.ts convex/modules/runtimeTelemetry/runtimeTelemetry.test.ts`
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

## Residuals

- Full `npm run typecheck` still fails from pre-existing workspace-wide UI debt
  unrelated to this telemetry slice, including missing UI/runtime dependencies,
  JSX namespace issues, office model type drift, and existing module export
  mismatches.
- Headless browser QA logs one office-scene WebGL failure:
  `Error creating WebGL context`. The captured telemetry panels still rendered
  and the error is from the office Three.js renderer path, not from the
  Telemetry module.
