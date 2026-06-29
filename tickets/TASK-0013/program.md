---
ticket_id: TASK-0013
kind: program
status: verified
created_at: 2026-06-25
updated_at: 2026-06-25
---

# TASK-0013 Program

```text
objective:
  Build a deterministic office layout solver that reserves walkable paths,
  packs objects around those paths, and prunes empty edge tiles while preserving
  connectivity.

inputs:
  - ticket: tickets/TASK-0013/ticket.md
  - current mapper: ui/src/providers/office-data-mapper.ts
  - area allocator: ui/src/modules/office/lib/office-area-layout.ts
  - quality scoring: ui/src/modules/office/lib/office-layout-quality.ts
  - occupancy: ui/src/modules/office/systems/occupancy-system.ts
  - placement: ui/src/modules/office/systems/placement-engine.ts

ordered_operations:
  1. Ground current helper ownership and identify the smallest extraction into
     office-layout-solver.ts.
  2. Add solver input/output types and a pure `solveOfficeAutoLayout` function.
  3. Implement required-object placement for `team_neighborhoods`.
  4. Build reserved walk tiles from required POI access centers before optional
     furniture placement.
  5. Pack optional furniture through placement reservations that include solid
     objects plus walk-path blockers.
  6. Prune exterior empty tiles while rejecting removals that disconnect POIs or
     cut reserved walk paths.
  7. Wire `toOfficeData` to use the solver for `team_neighborhoods`.
  8. Add focused tests and run proof checks.

non_goals:
  - generated walls
  - full graph/org layout strategy
  - locomotion system rewrite
  - manual builder mode rewrite

proof_route:
  - focused Vitest solver/provider tests
  - typecheck root
  - browser screenshot if local UI launches cleanly

loop:
  shape: active_goal
  owner: codex
  approval: approved by operator request on 2026-06-25
  drift_policy: compare work against ticket.md, program.md, and progress.md
    before each final/continuation response
  budget:
    time: current implementation window
    token_model_compute: not specified
    subagents: none required unless QA/review needs isolation
    spend: none
  final_evidence: include checks and strongest browser screenshot as
    Markdown image evidence when available; otherwise record blocker
```
