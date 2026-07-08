---
template_id: ticket-template
template_version: "0.1.3"
feature_refs:
  - FEAT-0114
ticket_id: TASK-0036
title: Day-windowed timeline pagination for reports and telemetry
phase: planning
status: review
owner: unassigned
claimed_by:
priority: high
depends_on:
  - TASK-0035
blocked_by: []
ready: true
approval_required: true
requires_qa: true
requires_demo: false
created_at: 2026-07-08T00:00:00+08:00
updated_at: 2026-07-08T22:10:00+08:00
next_action: review implementation evidence; capture full visual QA after headless WebGL/runtime debt is resolved
last_verification: "2026-07-08: focused report/timeline tests pass; root typecheck passes; browser-side timeline endpoint smoke passes; UI typecheck still fails on unrelated existing workspace debt"
decision_refs:
  - docs/features/FEAT-0114-dashboard-projection-architecture.md
---

# TASK-0036: Day-windowed timeline pagination for reports and telemetry

## Summary
Replace the current "load a broad window and slice in React" Timeline behavior
with day-windowed pagination owned by a project runtime endpoint and consumed by
a TanStack Query infinite hook. Reports become timestamped timeline events
selected by configurable ref/path patterns, while Convex realtime queries stay
on Convex hooks unless a later slice intentionally adopts the beta Convex
TanStack adapter.

## Scope
- In:
  - Add a module-local paged timeline contract for day windows, cursors, source
    filters, and source counts.
  - Add a Vite bridge endpoint that returns one project timeline day at a time.
  - Convert registry reports into `report_event` timeline rows using
    `created_at` as the event timestamp.
  - Add default report timeline patterns that include daily/weekly interval
    reports and exclude pulse/context reports.
  - Move Timeline fetching to TanStack Query `useInfiniteQuery` for the
    day-window bridge.
  - Keep Convex live hook telemetry on Convex hooks for this slice, but
    document the investigated Convex + TanStack Query boundary.
  - Reuse the same day-windowed report source in the Reports tab instead of
    loading the full registry into the browser.
- Out:
  - Migrating all Convex realtime queries to TanStack Query.
  - Installing `@convex-dev/react-query` in this first slice.
  - Full Team Panel high-level tab grouping.
  - Full telemetry dashboard redesign.
  - Rendering report Markdown bodies inline as canonical timeline content.
  - Adding browser `localStorage` settings for timeline patterns.

## Delta

```text
overall_before:
  - Timeline asks Convex for a 14-day / 80-row learning timeline, merges memory
    and communication rows in React, then hard-slices merged rows to 120.
  - Project config loads the whole report registry into the browser.
  - Reports has an archive-style tab and Overview pins daily/weekly, but report
    generation is not yet a first-class Timeline event.
  - Pulse and other high-volume report producers can make all-report browsing
    noisy.
overall_after:
  - Timeline loads one day at a time through a project runtime page endpoint.
  - Rows from hooks, memory, communication fallback, reports, and later
    telemetry share one `TeamTimelineRow`-compatible event spine.
  - Reports enter the Timeline only when they match configured include/exclude
    patterns; daily/weekly interval reports are the default visible report
    events.
  - Reports tab reuses the day-window source for archive browsing and no longer
    requires a full registry payload up front.
why_now:
  - Farplane report volume is already high: pulse alone can produce hundreds of
    markdown reports, while the operator mainly needs daily/weekly cadence
    reports in normal review.
  - Telemetry and report files will keep growing; the UI needs backpressure at
    the data boundary rather than after render.
problems:
  - before: The UI fetches too much project runtime data, then trims it locally.
    after: The Vite bridge returns the requested day and cursor page only.
    why_now: Report and telemetry volume will otherwise degrade Timeline,
      Reports, and future audit surfaces.
  - before: Reports are separate cards/archive rows.
    after: Report generation is represented as timestamped timeline events.
    why_now: The user expects generated reports to sit between other timeline
      events by invocation/report timestamp.
first_principles_basis:
  objective: Make the Team Workspace history surfaces scalable and readable.
  need: Operators should load recent context first, then page backward by day
    without noisy artifacts dominating the default view.
  assumptions: Local project runtime files can be paged by day through the Vite
    bridge; Convex hook telemetry can remain realtime for the current live
    slice.
  root_cause: Timeline grew as an in-component merge of several sources before
    report and telemetry volume forced a page contract.
  constraints: Do not add localStorage settings; keep project configuration in
    canonical Farplane files; avoid a broad Convex/TanStack migration.
  first_viable_slice: Day-window endpoint + Timeline infinite hook + report
    event adapter + default report pattern filter.
  proof_or_falsification: Today's Timeline loads only today's matching rows;
    previous-day fetch appends older rows; pulse reports remain hidden by
    default; daily/weekly interval reports appear as report events.
  tradeoff: Use the local Vite bridge as the pagination boundary before
    redesigning Convex telemetry pagination, accepting that Convex live rows and
    file-backed rows are composed at the UI/runtime boundary for now.
  non_goals: No beta Convex TanStack adapter adoption in this ticket, no full
    Team Panel IA redesign, no all-registry eager load.
```

## Change Plan

```text
architecture_signatures:
  module_level:
    - ui/src/modules/team-workspace/lib/timeline/
      owns typed ProjectTimelinePage contracts, source filters, report pattern
      matching, and conversion helpers.
    - ui/vite.config.ts
      owns local filesystem/runtime reads for day-windowed timeline pages.
    - convex/modules/hookTelemetry/queries.ts
      remains the Convex realtime source for hook telemetry rows; only bounded
      day/range query improvements are allowed if needed.
    - ui/src/modules/team-workspace/components/timeline-tab.tsx
      owns Timeline UI composition over paged rows.
    - ui/src/modules/team-workspace/components/tabs/reports/
      reuses timeline/report page data for archive-style browsing.
  main_flow:
    - readProjectTimelinePage(projectPath, params): ProjectTimelinePage
    - reportsToTimelineRows(reports, params): TeamTimelineRow[]
    - hookRowsToTimelineRows(rows): TeamTimelineRow[]
    - useProjectTimelinePages(params): UseInfiniteQueryResult<ProjectTimelinePage>
    - TimelineTab(params): renders page groups + previous-day/page controls
  data_flow:
    - Vite bridge reads local registry/memory sources and request params.
    - Convex hook telemetry stays realtime through `useQuery` for current live
      rows unless a bounded query call is explicitly added for day pages.
    - TanStack Query caches HTTP/Vite bridge pages by project path, day,
      source filters, report patterns, and cursor.
  builder_freeform_boundary:
    - Builders may tune control copy and component extraction, but must keep the
      page contract, default report patterns, and no-legacy/no-localStorage
      policy intact.
```

### Change 1: Shared Timeline Page Contract

```text
fixes:
  - Timeline, Reports, and telemetry need one page shape instead of one-off
    ad hoc loading rules.
before:
  - TeamTimelineRow is local to `team-timeline.ts` and source paging is implicit
    in each caller.
after:
  - A module-local timeline lib exports page params, page result, source enum,
    report pattern config, and conversion helpers.
read:
  - path: ui/src/modules/team-workspace/components/team-timeline.ts
    reason: preserve the existing event row fields and merge semantics.
  - path: ui/src/modules/team-workspace/components/timeline-model.ts
    reason: preserve clustering, formatting, and hook row conversion.
  - path: ui/src/modules/team-workspace/lib/project-config/config-types.ts
    reason: reuse report registry row types.
write:
  - path: ui/src/modules/team-workspace/lib/timeline/timeline-page-types.ts
    change: add `ProjectTimelineSource`, `ProjectTimelinePageParams`,
      `ProjectTimelinePage`, and `TimelineReportPatternConfig`.
  - path: ui/src/modules/team-workspace/lib/timeline/report-timeline.ts
    change: add report pattern matching and report-to-event conversion.
  - path: ui/src/modules/team-workspace/components/team-timeline.ts
    change: extend `sourceType` with `report_event` and accept already-paged
      rows without hard global slicing.
operation:
  - Keep helpers module-local until another module outside Team Workspace needs
    them.
signature_or_type_impact:
  - `TeamTimelineRow.sourceType` adds `"report_event"`.
  - `matchTimelineReport(refOrPath, config) -> boolean`.
  - `reportToTimelineRow(report, projectId): TeamTimelineRow | null`.
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - Unit tests cover include/exclude glob-ish matching, created_at parsing,
    sourceType assignment, and default daily/weekly-only inclusion.
failure_modes:
  - Pattern matching accidentally matches prose or labels instead of ref/path.
  - Pulse reports leak into the default Timeline.
```

### Change 2: Day-Window Vite Bridge Endpoint

```text
fixes:
  - Project runtime file sources currently load broadly through
    `/farplane/project-config`.
before:
  - `readFarplaneProjectConfig()` reads `.farplane/reports/index.json` and
    returns all normalized reports to the UI.
after:
  - A new `/farplane/project-timeline` endpoint returns one day/cursor page,
    with source counts and applied report patterns.
read:
  - path: ui/vite.config.ts
    reason: add endpoint beside existing project-config/feed-scout/kanban
      bridge handlers.
  - path: .farplane/reports/index.json
    reason: confirm real registry shape and day filtering behavior.
write:
  - path: ui/vite.config.ts
    change: add request parsing, safe project path validation, day window
      bounds, cursor parsing, source filters, and page assembly.
operation:
  - Request params: `projectPath`, `day`, `cursor`, `limit`, `sources`,
    `reportInclude`, `reportExclude`.
  - Day bounds: local timezone day start/end derived from requested day.
  - Cursor: stable opaque string or simple offset within the requested day.
  - Limit: bounded, default 80, hard cap 200.
signature_or_type_impact:
  - `GET /farplane/project-timeline?... -> ProjectTimelinePage`.
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - Endpoint test or focused helper test proves day filtering, limit cap,
    cursor continuation, invalid project path rejection, and report source
    counts.
failure_modes:
  - Endpoint scans report markdown bodies instead of registry frontmatter.
  - Cursor becomes unstable when new reports arrive.
  - Timezone handling drops late-night reports.
```

### Change 3: TanStack Query Timeline Pagination Hook

```text
fixes:
  - React components should not own request lifecycle, dedupe, retry, and
    incremental page state manually.
before:
  - `TimelineTab` directly uses Convex `useQuery` and merges local arrays in
    component scope.
after:
  - `useProjectTimelinePages()` uses TanStack Query `useInfiniteQuery` for the
    Vite bridge page endpoint. Convex realtime rows remain on Convex hooks in
    this slice.
read:
  - path: ui/src/providers/query-provider.tsx
    reason: verify existing QueryClientProvider and cache defaults.
  - path: ui/src/main.tsx
    reason: verify provider order with Convex.
  - path: docs/features/FEAT-0114-dashboard-projection-architecture.md
    reason: preserve the policy that TanStack Query owns HTTP/Vite bridge
      server state and Convex realtime stays on Convex hooks.
write:
  - path: ui/src/modules/team-workspace/lib/timeline/use-project-timeline-pages.ts
    change: add `useInfiniteQuery` hook with stable query keys and
      `getNextPageParam`.
  - path: ui/src/modules/team-workspace/lib/timeline/timeline-query-keys.ts
    change: add query key helper if needed to keep project/day/filter keys
      stable.
operation:
  - Initial page is the selected/today day.
  - `nextCursor` fetches more rows within the same day.
  - "Previous day" is an explicit UI action that changes or appends a day
    group; do not auto-fetch unbounded history.
signature_or_type_impact:
  - `useProjectTimelinePages(params): { pages, rows, state, fetchNextPage,
      hasNextPage, loadPreviousDay, selectedDay, sourceCounts }`.
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - Hook/component test with mocked fetch covers loading, page append,
    previous-day fetch, error, and query key isolation by projectPath.
failure_modes:
  - Query key omits report patterns and shows stale filter results.
  - Infinite query grows without a day boundary and recreates the original
    unbounded-load problem.
```

### Change 4: Convex + TanStack Boundary Investigation

```text
fixes:
  - The plan needs a deliberate answer for whether Convex query state should
    move to TanStack Query.
before:
  - Convex live Timeline rows use `convex/react` `useQuery`; TanStack Query is
    already available for HTTP bridge state.
after:
  - This ticket documents and enforces a boundary: use TanStack Query for the
    day-window Vite bridge; keep Convex realtime hooks for current live
    telemetry. Evaluate `@convex-dev/react-query` later only if a Convex query
    needs TanStack cache composition directly.
read:
  - path: convex/modules/hookTelemetry/queries.ts
    reason: inspect existing query indexes, limits, and learning timeline
      query.
  - path: convex/modules/hookTelemetry/schema.ts
    reason: verify eventAt/project indexes.
  - path: convex/modules/hookTelemetry/validators.ts
    reason: verify current args and lack of cursor/day-page args.
  - path: ui/src/providers/convex-provider.tsx
    reason: preserve standard Convex provider.
  - path: ui/src/providers/query-provider.tsx
    reason: preserve TanStack provider.
write:
  - path: docs/features/FEAT-0114-dashboard-projection-architecture.md
    change: add the investigated boundary and future optional adapter note.
  - path: tickets/TASK-0036/ticket.md
    change: keep this section as the implementation contract.
operation:
  - Do not install `@convex-dev/react-query` in this slice.
  - If Convex pagination is needed later, prefer Convex `.paginate()` and
    `usePaginatedQuery` or a deliberate adapter ticket.
signature_or_type_impact:
  - No runtime signature change in this slice.
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - Reviewer verifies no Convex realtime query was migrated accidentally.
failure_modes:
  - Mixing two reactive ownership models makes invalidation and subscriptions
    harder to reason about.
```

### Change 5: Timeline UI Integration

```text
fixes:
  - Timeline needs visible pagination controls and source/report filters that
    do not overload the operator.
before:
  - Timeline renders one merged set and one detail rail.
after:
  - Timeline renders day-window pages, has explicit previous-day / more-in-day
    controls, and includes report source filters.
read:
  - path: ui/src/modules/team-workspace/components/timeline-tab.tsx
    reason: replace direct broad loading with paged hook state.
  - path: ui/src/modules/team-workspace/components/timeline-components.tsx
    reason: add report badges/details and pagination controls while preserving
      current layout.
  - path: ui/src/modules/team-workspace/components/timeline-model.ts
    reason: preserve clustering and date labels.
write:
  - path: ui/src/modules/team-workspace/components/timeline-tab.tsx
    change: consume `useProjectTimelinePages`, source filters, and report
      preset state.
  - path: ui/src/modules/team-workspace/components/timeline-components.tsx
    change: add day controls, report event display, and source counts.
  - path: ui/src/modules/team-workspace/components/timeline-model.ts
    change: adjust grouping only if required for page boundaries.
operation:
  - Default report preset is pinned daily/weekly.
  - Pulse is opt-in.
  - Detail rail shows source path and summary, not full markdown body.
signature_or_type_impact:
  - Timeline props may drop direct memory/communication arrays after endpoint
    owns those sources, or keep them temporarily only as fallback.
routes:
  docs: update_docs
  qa: tests + visual_qa
  review: reviewer
qa:
  - Component tests cover empty, loading, one-page, multi-page, and report
    event rows.
  - Browser proof captures Timeline default pinned reports and previous-day
    loading.
failure_modes:
  - Nested scroll or control density makes the modal harder to use.
  - Report filter controls expose implementation jargon instead of operator
    concepts.
```

### Change 6: Reports Tab Reuse

```text
fixes:
  - Reports tab should not eagerly load the whole report registry when Timeline
    already has a day-window source.
before:
  - Reports tab filters/sorts all reports in the browser.
after:
  - Reports tab requests report-only day pages through the same timeline page
    endpoint and keeps search/filter/sort scoped to loaded days or server page
    params.
read:
  - path: ui/src/modules/team-workspace/components/tabs/reports/reports-tab.tsx
    reason: preserve current archive UI controls.
  - path: ui/src/modules/team-workspace/components/tabs/overview/overview-reports.tsx
    reason: preserve shared report display helpers.
write:
  - path: ui/src/modules/team-workspace/components/tabs/reports/reports-tab.tsx
    change: switch from all-registry runtime source to report-only paged hook.
  - path: ui/src/modules/team-workspace/components/tabs/overview/overview-reports.tsx
    change: only if helper extraction is needed for shared row rendering.
operation:
  - Reports tab remains useful as archive/search, but Timeline becomes the
    normal event browsing surface.
signature_or_type_impact:
  - Reports tab depends on ProjectTimelinePage report rows, not
    `runtimeSources.reports` wholesale.
routes:
  docs: update_docs
  qa: tests + visual_qa
  review: reviewer
qa:
  - Browser proof shows Reports does not render all pulse rows by default and
    can page older report days.
failure_modes:
  - Reports tab loses filename/kind/cadence affordances added in the prior
    slice.
```

## Gap Analysis
- Current state:
  - Team Workspace Timeline is an in-component composition over Convex
    `useQuery`, local memory rows, and communication fallback rows.
  - Report registry loading is attached to `/farplane/project-config`, which is
    too broad for high-volume report history.
  - TanStack Query provider already exists and wraps Convex provider in
    `ui/src/main.tsx`.
- Production expectation:
  - High-volume audit/history surfaces page by time or cursor at the data
    boundary.
  - Client components request bounded slices and keep pagination state in a
    server-state cache instead of holding one giant array.
  - Realtime sources and file-backed sources may coexist, but ownership should
    be explicit.
- Missing gaps:
  - No day-window timeline endpoint.
  - No report pattern config for Timeline.
  - No `report_event` row type.
  - No timeline pagination controls.
  - Reports tab currently wants all reports.
  - Convex hook telemetry queries are bounded by range/limit but not day/cursor
    pagination.
- Comparable implementations / docs:
  - TanStack Query v5 official infinite query docs: `getNextPageParam`,
    `hasNextPage`, and `fetchNextPage` are the intended primitives for paged
    server-state fetching.
  - Convex official TanStack Query docs: `@convex-dev/react-query` exists, is
    beta, and can be used alongside standard Convex hooks.
  - Convex official pagination docs: Convex supports `.paginate()` and
    `usePaginatedQuery` for reactive Convex pagination.
- Recommendation:
  - Implement day-window pagination first on the local Vite bridge through
    TanStack `useInfiniteQuery`.
  - Keep Convex realtime hooks unchanged for this slice.
  - Add a later ticket only if Convex hook telemetry itself needs reactive
    cursor pagination through Convex `.paginate()` or the beta TanStack adapter.

## Done

```text
done_when:
  - Timeline initially loads only the selected/today day.
  - Timeline can fetch more rows within the selected day when `nextCursor`
    exists.
  - Timeline can load the previous day without loading an unbounded range.
  - Report-generated rows appear in Timeline based on `created_at`.
  - Default report filters include daily/weekly interval reports and exclude
    pulse/context reports.
  - Reports tab uses the same day-windowed source instead of the full registry
    payload.
  - Convex realtime hooks remain on standard Convex hooks unless explicitly
    changed in a reviewed follow-up.
  - Feature docs describe the day-window contract and Convex/TanStack boundary.
```

### Implementation Receipt - 2026-07-08

- Added `/farplane/project-timeline` as the day-windowed Vite bridge endpoint
  for local project report/memory timeline rows.
- Added `ui/src/modules/team-workspace/lib/timeline/` with the typed page
  contract, report pattern matching, report-to-row conversion, and TanStack
  `useInfiniteQuery` hook.
- Added `report_event` timeline rows and wired Timeline to merge paged
  file-backed rows with existing Convex hook telemetry and communication rows.
- Kept Convex hook telemetry on standard Convex `useQuery`; no Convex TanStack
  adapter was installed or adopted in this slice.
- Changed Reports tab to page reports through the same day-windowed source and
  keep search/filter/sort over loaded pages instead of requiring the full
  registry payload in the browser.
- Updated FEAT-0114 with the report surface and day-window contract.

### Verification Receipt - 2026-07-08

- PASS: `npx biome check --write --files-ignore-unknown=true` on changed
  report/timeline files.
- PASS: `npm run test:once -- ui/src/modules/team-workspace/lib/timeline/report-timeline.test.ts ui/src/modules/team-workspace/components/team-timeline.test.ts ui/src/modules/team-workspace/lib/dashboard-projections/overview-summary-surface.test.ts ui/src/modules/team-workspace/components/tabs/overview/overview-report-model.test.ts`
  (`11` tests across `4` files).
- PASS: `npm run typecheck:root`.
- PASS: `npm run quality:smells -- full` completed with existing large-file
  warnings only.
- PASS: curl smoke for `/farplane/project-timeline` against
  `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane` returned bounded
  rows:
  - default pinned patterns: `rows=1`, `sourceCounts.report=1`,
    `previousDay=2026-07-06`.
  - all-reports tab patterns: `rows=5`, `nextCursor=5`,
    `sourceCounts.report=166`.
- PASS: Playwright browser-side `fetch('/farplane/project-timeline?...')`
  returned `status=200`, `ok=true`, `rows=1`, first row
  `sourceType=report_event`.
- NOT PROVABLE in this environment: full visual office screenshot flow. The
  `/office` route loaded but headless Chromium produced pre-existing Three.js
  WebGL context errors before the Team Panel visual flow could be proven.
- KNOWN UNRELATED DEBT: `npm run ui:typecheck` still fails on repo-wide
  existing errors outside changed report/timeline files, including `JSX`
  namespace issues, missing optional AI element packages, and unrelated office /
  runtime type mismatches. No changed report/timeline files were implicated
  after the test import fix.

## QA Strategy

```text
qa_strategy:
  proof_weight: visual_qa
  checks:
    - npm run test:once -- ui/src/modules/team-workspace/components/team-timeline.test.ts
    - npm run test:once -- ui/src/modules/team-workspace/lib/timeline
    - npm run test:once -- ui/src/modules/team-workspace/lib/dashboard-projections/overview-summary-surface.test.ts
    - npm run typecheck:root
    - npx biome check --files-ignore-unknown=true <changed files>
  manual:
    - Launch the Team Panel for a project with report registry data.
    - Open Timeline and confirm today loads first with source counts.
    - Confirm daily/weekly report events appear by timestamp.
    - Confirm pulse reports are absent until Pulse filter/preset is selected.
    - Load previous day and confirm older rows append under the correct day.
    - Open Reports tab and confirm it pages report days rather than rendering
      all registry rows at once.
  delegated_lanes:
    - visual-qa for Timeline and Reports tab screenshots after implementation.
    - reviewer for architecture, data-flow, and evidence-quality review.
  review:
    - rubric: implementation-plan
      required_tas: pass
    - rubric: architecture
      required_tas: pass
    - rubric: evidence-quality
      required_tas: pass
  evidence:
    - focused test output
    - root typecheck output or known unrelated failure note
    - browser screenshots for Timeline default, Timeline previous day, Reports
      archive page
    - endpoint sample JSON showing bounded rows and nextCursor behavior
  goal_advisor_inputs:
    proof_route: tests + browser visual QA + reviewer
    final_evidence: ticket artifacts with endpoint samples and screenshots
    final_checkpoint: reviewer pass after visual QA evidence is attached
  residual_risk:
    - Full `npm run ui:typecheck` currently has broad workspace debt unrelated
      to this ticket; implementation should scan output for new changed-file
      errors and report the existing failures separately.
    - Convex day/cursor pagination may need a follow-up if hook telemetry grows
      beyond the current realtime query windows.
grounding_evidence:
  local:
    - ui/src/modules/team-workspace/components/timeline-tab.tsx
    - ui/src/modules/team-workspace/components/team-timeline.ts
    - ui/src/modules/team-workspace/components/timeline-components.tsx
    - ui/src/modules/team-workspace/components/timeline-model.ts
    - ui/vite.config.ts
    - ui/src/providers/query-provider.tsx
    - ui/src/providers/convex-provider.tsx
    - convex/modules/hookTelemetry/queries.ts
    - convex/modules/hookTelemetry/schema.ts
    - docs/features/FEAT-0114-dashboard-projection-architecture.md
  official_docs:
    - https://tanstack.com/query/v5/docs/framework/react/guides/infinite-queries
    - https://docs.convex.dev/client/tanstack/tanstack-query/
    - https://docs.convex.dev/database/pagination
  note:
    - convex/_generated/ai/guidelines.md was requested by AGENTS but is not
      present in this checkout.
```

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - docs/features/FEAT-0114-dashboard-projection-architecture.md
    - ui/src/modules/team-workspace/README.md if the module entrypoint changes
  no_docs_reason:
  validation:
    - Docs mention day-window pagination, default report patterns, and the
      Convex/TanStack boundary.
```

## Agent Contract
- Open: `npm run dev --workspace @farplane/ui` or the repo's standard UI
  gateway, then open the Office/Team Panel for a project with
  `.farplane/reports/index.json`.
- Test hook: `/farplane/project-timeline?projectPath=<abs>&day=YYYY-MM-DD&limit=5`.
- Stabilize: use a fixture project or Farplane project with known daily/weekly
  reports and pulse reports.
- Inspect: Timeline tab rows, source count badge, report event badges, detail
  rail source path, Reports tab page controls.
- Key screens/states:
  - Timeline loading state
  - Timeline today with daily/weekly report events
  - Timeline previous day appended
  - Timeline pulse preset selected
  - Reports tab report-only day page
- Design baseline: existing dense Team Panel cards and Timeline layout; no
  hero/marketing treatment.
- QA cookbook: `qa/README.md`; add a cookbook only if browser proof becomes
  reusable.
- Expected artifacts: screenshots plus endpoint JSON snippets under
  `tickets/TASK-0036/artifacts/` if implemented as a Goal.

## Run Hints
- Likely size: large
- Goal recommendation: required
- Budget hint: normal implementation plus visual QA and reviewer lane
- Compute hint: local_worktree
- Planning hint: impl_plan complete; run goal-advisor after approval
- QA source: QA Strategy
- Batchability: single-ticket
- Batch reason: Cross-cuts Timeline, Reports, Vite bridge, and docs under one
  data contract; splitting before the page contract lands would duplicate
  proof.
- Human inputs/assets: none
- Credentials / external access: no new credentials; Convex local/cloud access
  only for existing realtime queries

## Notes
- The minimal implementation plan is the day-window bridge plus Timeline
  integration. Reports tab reuse is included because it prevents immediately
  reintroducing the all-registry load path.
- Do not adopt `@convex-dev/react-query` in this ticket. Convex official docs
  mark the adapter as beta and explicitly allow using it alongside standard
  Convex hooks; this ticket keeps the existing standard hooks for realtime data.
- Do not add localStorage for timeline patterns. Persist project/operator
  configuration through the canonical Farplane project config path in a
  follow-up if editable UI settings are needed.
- Goal Packet sidecars:
  - `tickets/TASK-0036/program.md`
  - `tickets/TASK-0036/progress.md`
  - `tickets/TASK-0036/generated-goal-prompt.md`

```text
plan_qa:
  minimal_required_version: pass
  reuse_before_new_surface: pass
  least_parameters: pass
  new_files_functions_justified: pass
  minimal_impl_plan_claim: pass
  existing_service_fit: pass
  goal_advisor_ready: pass
  clarifying_questions: pass
  architecture_signatures: pass
  change_plan_signature_linkage: pass
  change_plan_locality: pass
  qa_strategy_explicit: pass
  docs_strategy: pass
  independent_plan_review: revise - reviewer lane still required before build
  visual_companion_boundary: pass - no diagram companion needed before approval;
    UI proof requires screenshots instead
  visual_companion_colored_delta: not_applicable
  grounding_evidence: pass
  highest_risk: accidentally mixing Convex realtime ownership and TanStack
    Query HTTP page ownership.
  fix_or_deferral: keep Convex adapter adoption out of scope and document the
    boundary in FEAT-0114.
```
