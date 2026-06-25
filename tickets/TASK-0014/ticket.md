---
ticket_id: TASK-0014
title: Make auto layout follow the three-phase solver algorithm
phase: review
status: verified
owner: codex
claimed_by: codex
priority: high
depends_on:
  - TASK-0013
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-06-25
updated_at: 2026-06-25
next_action: review canonical solver evidence before archive
last_verification: 2026-06-25 focused Vitest, root typecheck, diff check, browser proof
---

# TASK-0014: Make Auto Layout Follow The Three-Phase Solver Algorithm

## Summary
The operator's intended office layout algorithm is simple and should be the
contract for automatic layouts:

1. Render the strategy graph (`treemap`, `graph`, `command district`, etc.),
   compact it as much as possible, and reserve shortest walking paths.
2. Optimize optional object placement around those reserved paths so as many
   legal objects as possible fit.
3. Remove empty edge tiles to lower empty-space score without violating blocked
   paths, required object access, or walkability.

TASK-0013 added a useful solver slice, but the mapper can still behave like an
old area-first pipeline. This ticket promotes the three steps above into the
canonical automatic layout contract, with `manual` remaining the only bypass.

## Scope
- In:
  - Treat the three-phase algorithm as the source of truth for all automatic
    office strategies.
  - Make the solver's public stages explicit: `renderStrategyGraph`,
    `reserveShortestWalkPaths`, `packOptionalObjects`, and `pruneEmptyEdges`.
  - Ensure `team_neighborhoods`, `activity_treemap`, and `command_districts`
    flow through the same solver pass after their strategy-specific graph or
    area seed is generated.
  - Make the mapper mostly prepare inputs and consume solver output instead of
    doing layout optimization itself.
  - Preserve manual builder coordinates exactly.
  - Preserve generated-wall-free behavior; team area debug UI remains the
    visual boundary signal.
  - Add tests that fail if the solver bypasses path-first packing or pruning.
- Out:
  - Reintroducing generated walls/dividers.
  - Full organization-chart visual design beyond the current strategy seeds.
  - New settings UI beyond existing layout strategies unless required by tests.
  - Rewriting employee locomotion or live polling behavior.

## Done / Proof

```text
done_when:
  - `solveOfficeAutoLayout` owns the canonical pipeline:
    strategy graph/seed -> shortest path reservation -> object packing -> edge
    pruning.
  - `manual` is the only layout strategy that bypasses the solver.
  - At least `team_neighborhoods`, `activity_treemap`, and `command_districts`
    pass through the same solver contract.
  - Optional furniture placement treats reserved walk cells as blockers.
  - Edge pruning reduces empty tiles while preserving required object access
    and important POI reachability.
  - No generated wall/divider code path is restored.

proof:
  checks:
    - npx vitest run ui/src/modules/office/lib/office-layout-solver.test.ts ui/src/providers/office-data-provider.test.ts ui/src/modules/office/lib/office-area-layout.test.ts
    - npm run typecheck:root
    - git diff --check
  manual:
    - Launch `npm run ui`, render `/office` with Team Neighborhoods and at
      least one other automatic strategy, and capture screenshot evidence.
    - Confirm the local sidecar strategy is restored after any proof toggles.
  review:
    - rubric: the implementation makes the operator's three-step algorithm
      visible in code shape and tests, instead of hiding it in mapper glue.
      required_tas: advisory unless a reviewer lane is already available.
  evidence:
    - best browser screenshot image path
    - progress.md proof entry
```

## State
- `next_action:` review canonical solver evidence before archive
- `blocked:` false
- `latest_verification:` 2026-06-25 focused Vitest, root typecheck, diff check, browser proof
- `result:` implemented and verified
- `note:` `ui/src/modules/office/lib/office-layout-solver.ts` is 870 lines
  after making the stages explicit. Split plan: after review, extract
  strategy-seed rendering, route reservation, object packing, and edge pruning
  into module-local solver stage files while preserving the
  `solveOfficeAutoLayout` public contract and tests.

## Links
- `program:` tickets/TASK-0014/program.md
- `progress:` tickets/TASK-0014/progress.md
- `generated_goal_prompt:` tickets/TASK-0014/generated-goal-prompt.md
- `artifacts:` tickets/TASK-0014/artifacts/
- `refs:` tickets/TASK-0013/ticket.md
