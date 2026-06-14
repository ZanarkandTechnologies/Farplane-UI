---
title: TKT-013 Goal Program
ticket: tickets/building/TKT-013-telemetry-dashboard/ticket.md
created_at: 2026-06-13
---

# TKT-013 Goal Program

## Trigger

- active_goal: continue implementation until Done / Proof is satisfied, blocked,
  or the operator redirects.

## Execution Profile

- Bias: build the missing dashboard/raw split with the smallest durable
  extension to the existing telemetry module.
- Time policy: one focused Goal window; do not broaden into ingestion/auth
  redesign unless required for chart data correctness.
- Subagents: allowed for independent UI QA, chart/reference inspection, or
  review if they materially improve proof quality.
- Spend: none.

## Metric / Feedback Provider

- hybrid:
  - mechanical: focused runtime telemetry tests, focused UI lint/typecheck/build
    where possible, and `git diff --check`
  - browser evidence: screenshots for global dashboard, global raw telemetry,
    team dashboard, and team raw telemetry
  - review judgment: dashboard/raw IA is clear, charts are real data views,
    filtered-duration confidence is visible, and privacy boundary is preserved
  - human feedback: operator confirms the result now feels like the expected
    telemetry dashboard rather than only tables

## Drift Policy

- Inline drift check after each material step:
  - compare implementation against `ticket.md` Scope, Done / Proof, and Hard
    privacy gates
  - preserve TKT-010 duration semantics and suspicious-duration filtering
  - keep UI dense and operational, not decorative or marketing-like
  - avoid importing old Aikage/Farplane-Console components wholesale
- Request reviewer lane before done if query contracts, chart aggregation, or
  privacy boundaries change beyond the existing telemetry module.

## Budget

- time: one active implementation window; pause only for destructive decisions,
  missing local services, or operator redirect
- tokens/model/compute: not specified
- QA: browser evidence required before completion
- review: inline review required; reviewer lane if shared contracts expand
- spend: none

## Stop Conditions

- complete: all Done / Proof boxes in `ticket.md` are satisfied, evidence is
  linked, and residual workspace failures are documented as pre-existing.
- blocked: three consecutive attempts cannot run the UI/query proof because of
  missing local services or incompatible workspace state, and no useful mocked
  or no-Convex proof path remains.
- pause: operator redirects scope, asks for planning/review only, or a durable
  schema/auth/deploy decision is required.

## Current Execution Order

1. Read `plan.md`, current telemetry UI, reducer/query data shape, Console
   chart references, and QA runbooks.
2. Add Recharts to the UI workspace and port the shadcn chart wrapper.
3. Extend telemetry reducer/query output with Aikage parity fields while
   preserving duration-cap filtering.
4. Replace custom dashboard chart primitives with Recharts-backed metric strip
   and chart sections/modes.
5. Preserve Raw Telemetry pagination, source/status filters, public-mode hide,
   and privacy boundary.
6. Reuse the same component pattern for Team Telemetry scope.
7. Run focused reducer tests, lint, typecheck/build checks, and diff hygiene.
8. Capture browser evidence for global/team dashboard/raw views.
9. Append final proof and drift verdict to `progress.md`.
