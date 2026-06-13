# TKT-010 Goal Program

## Trigger

- active_goal: continue implementation until Done / Proof is satisfied, blocked, or the operator redirects.

## Metric / Feedback Provider

- hybrid:
  - mechanical: reducer/query tests, typecheck, lint, `git diff --check`
  - browser evidence: global Telemetry dashboard and Team Panel Telemetry tab
  - review judgment: compact shadcn-native UI, privacy boundary, and no duplicate timeline semantics

## Drift Policy

- Inline drift check after each material step:
  - compare current edits against `ticket.md` Scope and Hard gates
  - preserve shadcn-style UI direction from `docs/TASTE.md`
  - keep telemetry duration semantics limited to completed matched lifecycle turns
- Use reviewer lane before done if ingest/auth surface expands beyond the local hook/private deployment pattern.

## Stop Conditions

- complete: ticket Done / Proof is satisfied or residual failures are clearly pre-existing and documented
- blocked: required runtime schema/auth decision or missing local service prevents meaningful progress after attempted alternatives
- pause: operator redirects scope, asks for review-only, or requests a narrower slice

## Current Execution Order

1. Ground code surfaces and preserve dirty worktree.
2. Add Convex `runtimeTelemetryActivityPings` schema, ingest, shared reducer, and queries.
3. Add reducer tests for completed, in-progress, unmatched, and team/global totals.
4. Add global telemetry module and office launcher action.
5. Add Team Panel Telemetry tab.
6. Run mechanical checks.
7. Run browser QA and record evidence/progress.
