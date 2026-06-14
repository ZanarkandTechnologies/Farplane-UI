---
title: Aikage Telemetry Gap
ticket: tickets/building/TKT-013-telemetry-dashboard/ticket.md
created_at: 2026-06-14
---

# Aikage Telemetry Gap

## Verdict

The current Farplane UI telemetry implementation is a useful dashboard/raw
split, but it is not yet the old Aikage/Farplane-Console telemetry dashboard.
The missing work is mostly derived data shape and chart-library adoption, not
raw ingestion.

## Chart Library Decision

Recommendation: use Recharts for Farplane UI telemetry.

Evidence:

- Farplane-Console already depends on `recharts@3.8.0`.
- Farplane-Console already has a shadcn-style `ChartContainer`,
  `ChartTooltip`, and `ChartTooltipContent` wrapper around Recharts.
- Recharts official docs position it as a React component chart library built
  on SVG and D3 submodules.
- `react-chartjs-2` is viable for Chart.js, but it adds a canvas-first
  adapter stack and does not match the existing Console implementation.
- TanStack React Charts docs currently mark v3 docs as beta/work-in-progress,
  so it is a weaker fit for this parity pass.

## Console / Aikage Dashboard Evidence

Files inspected:

- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/src/features/dashboard/DashboardPage.tsx`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/src/features/dashboard/components/DashboardChartStage.tsx`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/src/features/dashboard/components/DashboardMetricStrip.tsx`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/src/features/dashboard/components/HourlyAgentHoursSpectrum.tsx`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/src/features/dashboard/components/ParallelCapacityTrendChart.tsx`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/src/features/dashboard/components/ProjectBreadthChart.tsx`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/src/features/dashboard/components/LongestTurnLineChart.tsx`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/convex/dashboard.ts`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-Console/convex/lib/parallelCapacity.ts`
- `/Users/kenjipcx/coding-harness/Codexter/docs/specs/farplane-aikage-telemetry-sync.md`

## Missing From Farplane UI

- Recharts dependency and shadcn chart wrapper.
- Metric strip:
  - Today agent-hours.
  - Delta vs yesterday.
  - 30d total and average/day.
  - Daily capacity percent.
  - Availability percent and covered hours.
  - Peak parallel sessions/projects.
  - Today project breadth.
  - Longest turn.
- Derived query fields:
  - `agentHourSummary`.
  - `hourlyBuckets` for last-24h stop-hour/source map.
  - `parallelCapacity` daily buckets.
  - `coveredHours` and availability percent.
  - `longestTurnDurationMs`, `longestTurnEndedAt`, and project label.
  - day-scoped project/team breakdown maps.
  - activity-day rows for scoped filtering.
- Chart modes / views:
  - Agent-hours heatmap over 7d/30d.
  - Daily capacity heatmap.
  - Last-24h hourly source map.
  - Parallel capacity trend.
  - Project breadth chart.
  - Longest single-turn chart with a 3h reference line.
  - Availability history strip.
- Interaction:
  - 7d/30d range control for chart focus.
  - Click a day to scope contribution/activity panels.
  - Project/team or machine filters over activity rows.

## Existing Farplane UI Slice

The current Farplane UI slice has:

- `Dashboard`, `Projects`, `Teams`, and `Raw Telemetry` tabs.
- Metric cards for total agent hours, filtered, open turns, projects, and pings.
- Basic custom SVG/HTML charts for agent-hours trend, lifecycle health,
  completed turns, and top projects.
- Raw telemetry pagination and source/status filters.
- Duration-cap filtering and source confidence labels.

That is enough for a thin overview, but not enough for the product question:
how much parallel work capacity did the agents create over the last day/week,
which projects consumed it, and where telemetry confidence is weak.

## Proposed Implementation Order

1. Add Recharts and port the Console chart wrapper into
   `ui/src/components/ui/chart.tsx`.
2. Extend `convex/modules/runtimeTelemetry/runtimeTelemetry.ts` with derived
   fields, using the Console algorithms as references while preserving the
   Farplane duration-cap filtering.
3. Replace custom chart primitives in
   `ui/src/modules/telemetry/telemetry-dashboard-views.tsx` with Recharts
   components.
4. Add metric strip and chart mode sections for Aikage parity.
5. Preserve the current Raw Telemetry tab and tests.
6. Capture browser proof for global and team dashboard states.
