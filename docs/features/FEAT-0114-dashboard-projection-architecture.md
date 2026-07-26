---
kind: feature-spec
status: proposed
project: Farplane UI
created_at: 2026-07-01
updated_at: 2026-07-24
owner: team-workspace
related_systems:
  - ../systems/README.md
source_refs:
  - ../../farplane/harness.yaml
  - ../../farplane/metrics.yaml
  - ../../ui/src/modules/team-workspace/lib/dashboard-projections/goal-kpi-model.ts
  - ../../ui/src/modules/team-workspace/components/tabs/overview/overview-tab.tsx
  - ../../ui/vite.config.ts
external_grounding:
  - https://www.metabase.com/docs/latest/dashboards/introduction
  - https://www.metabase.com/docs/latest/configuring-metabase/caching
  - https://grafana.com/docs/grafana/latest/administration/data-source-management/
  - https://superset.apache.org/admin-docs/configuration/cache/
  - https://tanstack.com/query/latest
---

# Dashboard Projection Architecture

Farplane Overview dashboards should render compiled project projections, not
let each card independently fetch and interpret raw project files. The
dashboard contract is:

```text
raw provider exports + tickets + telemetry + reports + farplane/harness.yaml + farplane/metrics.yaml
  -> metric snapshot compiler
  -> overview projection compiler
  -> frontend fetch hook
  -> pure dashboard cards
```

This mirrors common dashboard product architecture: cards are configured views
over queries or metrics, query results are cached or materialized, and the
frontend manages freshness rather than recomputing raw data per card.

## Source Contracts

- `farplane/harness.yaml` owns selected objective and guard refs.
- `farplane/metrics.yaml` owns reusable metric meaning, direction, freshness,
  display, and guard semantics.
- `.farplane/metrics/ui/latest.json` owns compiled metric observations for UI
  consumers.
- `.farplane/state/overview_surface.json` owns the render-ready Overview
  projection.
- The board/ticket backend owns actionable work, including human action items
  and gaps that need follow-up.
- `.farplane/reports/index.json` owns the UI-facing report registry generated
  from report frontmatter under `.farplane/reports/**`.
- `.farplane/highlights/wins.jsonl` and
  `.farplane/highlights/failures.jsonl` own minimal append-only Interval
  selections. Core resolves their report refs and emits render-ready cards
  under the optional `tabs.highlights` project-snapshot slice.

The UI may show source paths and freshness, but it should not treat report
Markdown or raw social exports as the primary dashboard API.

## Metric Snapshot

The existing UI expects this shape for `.farplane/metrics/ui/latest.json`:

```ts
type MetricsUiSnapshot = {
  snapshot_date: string;
  generated_at: string;
  metrics: KpiMetricRow[];
  source_gaps: MetricSourceGap[];
};
```

The compiler should create this file from available platform exports, social
content review files, telemetry, and future provider adapters. Missing data
should become `source_gaps[]`, not silent zeroes.

Run the local compiler with:

```bash
npm run dashboard:compile -- --project .
```

## Overview Projection

The Overview projection is the stable API for the Overview tab:

```ts
type OverviewSurface = {
  generated_at: string;
  project_id: string;
  pins: OverviewPinCard[];
  attention: AttentionItem[];
  wins: OverviewHighlightCard[];
  failures: OverviewHighlightCard[];
  reports: ReportLink[];
  sources: SourceRef[];
};
```

`pins` should contain at most four cards. Horizon Advisor can mark KPI nodes
with overview pin metadata during KPI breakdown, and the compiler resolves that
intent into render-ready cards.

```ts
type KpiOverviewHint = {
  pin?: boolean;
  priority?: number;
  reason?: string;
  card_kind?: "number" | "trend" | "status" | "cost" | "queue";
};
```

The projection compiler owns tie-breaking, fallback cards, missing provider
state, and provenance. Card components only render projection rows.

## Interval Highlight Surface

Interval owns highlight admission after a Daily or Weekly report is finalized.
A win must describe exceptional verified metric movement. Failure highlights
are Daily-only and admit at most one failure for each team and calendar period;
each must include a reusable lesson. Weekly reports may summarize failures but
do not add gallery cards. The browser does not infer either from report prose.

Core projects the local ledgers into an additive schema-v2 slice:

```ts
type ProjectHighlights = {
  wins: ProjectHighlightCard[];
  failures: ProjectHighlightCard[];
  source_gap_ids: string[];
};
```

Cards include stable derived identity, the project-local `team` slug, source
report ref, summary, optional lesson, generic labelled links, cadence/period,
and source-gap references. Core keeps file targets project-relative; Team
Workspace resolves them against the active project path for navigation. It uses
one adapter to compare the project-local slug with active UI keys such as
`team-proj-farplane`; it does not query or extend a Convex task store.

Overview renders wins and failures as separate galleries. The failure gallery
shows one “Failure of the day” card per period, ignores weekly rows, and
deterministically collapses duplicate same-day rows as a tolerant rendering
guard. The UI groups those Daily records into Monday-based browsing weeks
without adding votes, ranking, promotion state, another highlight record, or a
second persistence layer. JSONL remains canonical highlight state, Core
remains the derivation owner, and the UI remains a tolerant renderer.
Convex persistence and synchronization are outside this feature.
Project-relative evidence links open through the read-only
`/farplane/project-file` bridge, which confines reads to the selected project
root instead of relying on browser-blocked `file://` navigation.

## Report Surface

Reports have two UI entry points over the same registry-backed rows:

- Overview shows a compact Reports card for pinned/current cadence reports,
  initially the latest daily and weekly interval reports.
- The Reports tab shows the full project report registry from
  `<project>/.farplane/reports/index.json`, with filename, kind, cadence,
  search, filter, and sort controls. In the Team Panel, Reports belongs beside
  Timeline because both are history/audit surfaces.

Both surfaces consume the Core report registry. Neither surface should crawl
fixed daily/weekly paths or parse Markdown bodies as the canonical report list.

The Team Panel has enough entry points that the next navigation design pass
should group tabs into higher-level modes, likely separating command/status,
work execution, history/reports, project setup, and diagnostics.

## Attention Items

Open gaps should compile into attention items rather than live as a separate
dashboard object.

```ts
type AttentionItem = {
  id: string;
  kind: "gap" | "ticket" | "human_action";
  title: string;
  linked_ticket_id?: string;
  ticket_status?: string;
  attention_reason: string;
  owner: "agent" | "human" | "system";
  first_seen_at?: string;
  age_hours?: number;
};
```

If a gap needs work, it should link to a ticket. If it needs the operator, it
should be represented as a human action item or review-needed ticket. If it is
only informational, it belongs in the detailed Goals, Distribution, Telemetry,
or Reports surfaces rather than the Overview top band.

## Frontend Fetching

The frontend should use TanStack Query for HTTP/Vite-bridge server state,
starting with one module-local hook for the Overview projection:

```ts
useOverviewSurface(projectPath, enabled)
  -> { surface, state, error, refresh }
```

TanStack Query owns cache lifetime, dedupe, retry, refetch, and invalidation
policy for project-runtime HTTP endpoints. Convex realtime queries should stay
on Convex's `useQuery`; TanStack Query is for Vite bridge and other ordinary
HTTP-backed server state.

Timeline, Reports, and future high-volume telemetry surfaces should use
day-windowed pages rather than loading a broad history window and slicing in
React:

```ts
type ProjectTimelinePage = {
  day: string;
  rows: TeamTimelineRow[];
  nextCursor?: string;
  previousDay?: string;
  sourceCounts: Record<string, number>;
};
```

Reports enter this timeline as `report_event` rows selected by ref/path
patterns. The default Timeline pattern includes daily and weekly interval
reports and excludes pulse/context reports; pulse remains opt-in because it is
a high-volume heartbeat artifact. Use TanStack Query `useInfiniteQuery` for
these Vite bridge pages. Keep Convex realtime hook telemetry on Convex hooks in
this slice; Convex's TanStack adapter can be evaluated later only if a Convex
query itself needs TanStack cache composition.

Effect is not the React fetching layer for this slice. It may be reconsidered
later for projection compiler or provider-ingestion code if typed failures,
parallel reads, retries, resource cleanup, or dependency injection become
large enough to justify the additional runtime model.

## Non-Goals

- Do not make each card fetch raw X, Instagram, ticket, telemetry, and report
  data independently.
- Do not parse report Markdown, JSON blocks embedded in reports, or fixed
  daily/weekly report paths as the canonical dashboard input.
- Do not add user pin review as a requirement for the first slice. Horizon
  Advisor may choose pins agentically, while future operator overrides can
  remain a separate config capability.
- Do not add a broad dashboard schema store when the compiled projection file
  satisfies the current local-first UI contract.
- Do not parse interval report prose in the browser or use a Convex task store
  as a highlight source.
- Do not migrate Convex realtime state to TanStack Query.
- Do not introduce Effect into React dashboard components for this slice.

## Proof

Implementation should prove:

- metric snapshot parsing still handles available metrics and source gaps;
- the Overview projection compiler emits at most four pinned cards;
- attention items preserve ticket/gap status and ownership;
- the Overview tab renders from the projection with source freshness and useful
  empty states;
- the Metrics or Goals surface can still drill into the full KPI tree and
  snapshot detail.
