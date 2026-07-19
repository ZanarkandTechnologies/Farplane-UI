# Harness Usage Module

Runtime usage surfaces for completed agent hours, project/team contribution,
lifecycle diagnostics, and finance-metric portfolio roll-ups.

## Entrypoints

- `TelemetryPanel` for the global Harness Usage office launcher surface.
- `TelemetryDashboardContent` for global and team-scoped usage rendering.
- `useGlobalFinanceRollup` for read-only aggregation of finance-labeled project
  metric observations into global HUD summaries.

## Structure

- `components/` contains telemetry-only presentation components and component-local CSS.
- `hooks/` owns cached read-only bridge queries for global telemetry projections.
- `lib/finance-metric-rollup.ts` owns finance discovery and current-month aggregation.
- `telemetry-dashboard-types.ts` and `telemetry-dashboard-format.ts` stay module-level shared helpers for all telemetry entrypoints.

Finance roll-ups discover definitions through `finance.flow=expense|income` and
`finance.basis=actual|estimated`; they do not recognize finance by metric ID.
Only same-currency values may be combined, and estimates stay separate from
actual cash observations. Finance observations are non-negative amounts, with
their direction carried by `flow`; current-month selection uses the operator's
local calendar month. Failed registered-project reads remain visible as
unavailable source coverage instead of disappearing from the roll-up.

## Test

- `npm run test:once -- runtimeTelemetry telemetry team-panel`
- Browser QA through the office launcher and Team Panel Usage tab.
