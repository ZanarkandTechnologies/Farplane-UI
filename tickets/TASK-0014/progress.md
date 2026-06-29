---
ticket_id: TASK-0014
kind: progress
status: verified
created_at: 2026-06-25
updated_at: 2026-06-25
---

# TASK-0014 Progress

## 2026-06-25 Goal Start
- Operator corrected the prior implementation direction and restated the
  desired canonical algorithm:
  1. render/compact strategy graph and draw shortest walk paths,
  2. optimize optional object placement,
  3. remove empty edge tiles without breaking blocked ways.
- Goal Advisor classified this as an `active_goal`: material UI behavior,
  ticket-backed state required, approved by explicit operator request.
- Created TASK-0014 as the follow-up to TASK-0013 so the new goal can replace
  the remaining mapper-first behavior with the operator's algorithm.
- Next action: promote solver stages and route all automatic strategies through
  the canonical pipeline while keeping manual untouched.

## 2026-06-25 Implementation
- Made the solver debug contract expose the literal stages:
  `render_strategy_graph`, `reserve_shortest_walk_paths`,
  `pack_optional_objects`, and `prune_empty_edges`.
- Replaced the optional-object ring heuristic with a gap-aware scored packer:
  object footprints are inflated by a configurable minimum gap, larger objects
  place first, every legal tile is scored by compactness around the team
  centroid, and objects are dropped only when no legal gap-preserving placement
  exists.
- Changed `toOfficeData` so every non-manual layout strategy routes through
  the canonical solver. Automatic strategies now use strategy-aware ordering
  followed by compact graph-node anchors before the shared path, packing, and
  prune pass.
- Kept `manual` as the only bypass and preserved exact manual coordinates.
- Kept generated wall/divider paths absent; team area debug overlays remain the
  visual boundary signal.
- Updated tests so unlocked divider-like objects are packable optional objects,
  not room-boundary authorities.
- Solver source is now 870 lines; ticket.md records the follow-up split plan.

## 2026-06-25 Proof
- `npx vitest run ui/src/modules/office/lib/office-layout-solver.test.ts ui/src/providers/office-data-provider.test.ts ui/src/modules/office/lib/office-area-layout.test.ts`
  passed: 3 files, 52 tests.
- `npm run typecheck:root` passed.
- `git diff --check` passed.
- Browser proof captured with temporary sidecar strategy toggles and confirmed
  sidecar restore to `activity_treemap`:
  - `tickets/TASK-0014/artifacts/screens/team_neighborhoods-canonical-solver-proof.png`
    rendered with `EMPTY 26%`, `AGENTS 14`, and `WALK 100%`.
  - `tickets/TASK-0014/artifacts/screens/activity_treemap-canonical-solver-proof.png`
    rendered with `EMPTY 26%`, `AGENTS 14`, and `WALK 100%`.
- Browser had no page errors. Console recorded nine 502 bridge resource errors
  in each proof run, matching the local app-server bridge state; the office
  scene still rendered and screenshot proof was captured.

## 2026-06-25 Employee Desk Target Fix
- Root cause: `useEmployeeLocomotion` captured the assigned desk target in
  `initialPositionRef` only on first mount. Automatic layout recalculation
  moved team clusters and procedural desks, but mounted employee avatars kept
  routing to their stale pre-reflow desk coordinates.
- Added pure locomotion target helpers so desk-target updates, heartbeat desk
  routing, and snap-vs-walk behavior share one tested decision surface.
- Updated the locomotion hook so changed `position` props update the assigned
  desk target, clear stale desk paths and failed-path cache, and snap only when
  the avatar was still standing at the previous desk target.
- Added provider coverage that generated employee `initialPosition` values are
  derived from the final rendered procedural desk position for their assigned
  `deskId`.
- Proof:
  - `npx vitest run ui/src/modules/office/components/employee/employee-locomotion-targets.test.ts ui/src/modules/office/scene/use-office-scene-derived-data.test.ts ui/src/modules/office/utils/layout.test.ts`
    passed: 3 files, 17 tests.
  - `npx vitest run ui/src/providers/office-data-provider.test.ts ui/src/modules/office/components/employee/employee-locomotion-targets.test.ts`
    passed: 2 files, 44 tests.
  - Browser proof captured at
    `tickets/TASK-0014/artifacts/screens/employee-desk-target-sync-proof.png`
    with JSON probe evidence at
    `tickets/TASK-0014/artifacts/browser-qa/employee-desk-target-sync-proof.json`.
    The office rendered one canvas, 12 live employee positions, 20 click-probe
    targets, and zero page errors.

## 2026-06-25 Inside-First Object Packing
- Reworked optional object placement into an explicit inside-first packing
  pass followed by bounded overflow expansion:
  - optional objects still sort by inflated footprint size,
  - every object first tries all legal positions inside the current floor,
  - only unplaced leftovers search outside-floor candidates,
  - overflow candidates add the object's footprint plus a direct reserved
    access lane back to the current layout,
  - final prune/connectivity validation still owns the compact office shape.
- Added solver debug counts for inside placements, overflow placements,
  unplaced objects, and expansion tiles so future QA can tell whether furniture
  was packed into existing space or required an annex.
- Kept the overflow search approximate and bounded after provider tests exposed
  that full corridor scoring per candidate was too slow for multi-project
  fixtures.
- Proof:
  - `npx vitest run ui/src/modules/office/lib/office-layout-solver.test.ts ui/src/providers/office-data-provider.test.ts ui/src/modules/office/lib/office-area-layout.test.ts ui/src/modules/office/components/employee/employee-locomotion-targets.test.ts ui/src/modules/office/scene/use-office-scene-derived-data.test.ts ui/src/modules/office/utils/layout.test.ts`
    passed: 6 files, 72 tests.
  - `npm run typecheck:root` passed.
  - `git diff --check` passed.
  - Browser proof captured at
    `tickets/TASK-0014/artifacts/screens/inside-first-object-packing-proof.png`
    with JSON probe evidence at
    `tickets/TASK-0014/artifacts/browser-qa/inside-first-object-packing-proof.json`.
    The office rendered one canvas, 13 live employee positions, 21 click-probe
    targets, and zero page errors.
