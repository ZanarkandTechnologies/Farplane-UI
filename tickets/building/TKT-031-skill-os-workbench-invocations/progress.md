---
ticket: TKT-031
title: Skill OS workbench invocation progress
status: active
created_at: 2026-06-14
---

# Progress

## 2026-06-14 Goal Packet Created

- trigger: operator requested an implementation plan and Goal for Skill OS
  workbench tabs plus invocation counters
- intent: build the UI around the existing graph and invocation telemetry,
  leaving Reagraph fixes out of scope
- files/artifacts:
  - `tickets/building/TKT-031-skill-os-workbench-invocations/ticket.md`
  - `tickets/building/TKT-031-skill-os-workbench-invocations/program.md`
  - `tickets/building/TKT-031-skill-os-workbench-invocations/progress.md`
- metric sample: packet created; implementation pending
- drift verdict: aligned
- next_action: launch Goal and implement scoped UI changes
- blockers: none

## 2026-06-14 Implementation + QA

- trigger: native Goal execution for TKT-031
- branch/worktree: `main`, per operator correction
- changes:
  - added Skill OS top-level tabs: `Skill Tree`, `Invocations`,
    `Standards / Rollout`
  - added `use-skill-invocation-counts.ts` adapter over the TKT-025 Convex
    invocation dashboard query
  - added invocation badges to sidebar/selected-skill preview
  - added selected-skill full-page workbench with Overview, Todo, QA Tasks,
    Checklist, References, File Graph, Evals, UI, and Raw Files tabs
  - added virtual skill artifact graph and special renderers derived from the
    embedded skill document
  - added Standards / Rollout template/version table
  - added unit coverage for the workbench model parser
- proof:
  - browser screenshots captured for Skill Tree, workbench overview, file
    graph, Invocations, and Standards / Rollout
  - browser assertions passed on `main`
  - focused tests passed: 3 files, 6 tests
  - formatter passed
- known noise:
  - headless browser logs one existing office renderer WebGL context page error
  - workspace typecheck still fails on existing broad repo debt; focused filter
    found no Skill OS / invocation errors
- artifacts:
  - `artifacts/qa-2026-06-14-skill-os-workbench/report.md`
  - `artifacts/qa-2026-06-14-skill-os-workbench/*.png`
  - `artifacts/qa-2026-06-14-skill-os-workbench/qa-assertions.json`
- drift verdict: aligned
- next_action: stop dev server and close Goal
- blockers: none
