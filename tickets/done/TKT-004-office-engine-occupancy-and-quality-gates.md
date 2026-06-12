---
id: TKT-004
title: Office engine occupancy system and quality gates
state: done
owner: kenji
assignee: Codex
complexity: L
created: 2026-06-12
---

# TKT-004: Office engine occupancy system and quality gates

## Status

- state: `done`
- owner: Kenji
- assignee: Codex
- dependencies: existing office placement/shuffle work, office object sidecar state, module boundary rules
- location: `tickets/done/TKT-004-office-engine-occupancy-and-quality-gates.md`
- enter when: collision fixes revealed that placement logic is spread across mapper, UI utilities, CLI validation, and debug overlays
- leave when: engine refactor, quality gates, tests, browser proof, and review are complete
- blockers: none for planning; implementation should avoid broad scene rewrites in the first pass
- spawned follow-ups: none yet
- complexity: `L`

## Description

Office object placement currently works through a mix of footprint helpers, mapper-level reservation logic, CLI AABB checks, and debug overlays. That fixed immediate collisions, but it is not yet shaped like a reusable game-engine subsystem. This ticket turns placement into a first-class office engine layer and adds lightweight quality gates so future changes do not recreate long-file, hidden-logic, or duplicate-collision bugs.

## Goal

Create a modular office occupancy/collision/placement system that can be consumed by UI rendering, builder dragging, generated project tables, CLI shuffle/doctor commands, debug overlays, and eventually pathfinding. Add pre-commit/pre-push checks that flag large files and office placement ownership drift before those smells land.

## Acceptance Criteria

- [x] AC-1: Office runtime has a first-class `occupancy-system` that owns footprint cells, layout containment, collision reports, and placement predicates.
- [x] AC-2: Existing UI placement consumers import collision/footprint behavior through `ui/src/modules/office/systems/*`, not ad hoc utils.
- [x] AC-3: Generated team clusters and sidecar furniture use the same occupancy contract for candidate selection and collision avoidance.
- [x] AC-4: Builder drag/move validation can call a single `canPlaceOfficeObject`-style API before persisting transforms.
- [x] AC-5: CLI `office doctor`, `office arrange`, and `office shuffle` either share the same pure contract or have a documented adapter that mirrors the UI engine contract with parity tests.
- [x] AC-6: Debug grid overlays visualize occupancy cells from the engine contract.
- [x] AC-7: Pathfinding integration is explicitly planned or wired so walkability can be derived from occupancy without hand-duplicated obstacle assumptions.
- [x] AC-8: Pre-commit/pre-push checks flag oversized source files and office placement ownership drift.
- [x] AC-9: Tests cover collision, off-floor placement, rotation/clearance, generated table layout, and at least one no-path graceful fallback.

## Things To Implement

- [x] Add `ui/src/modules/office/systems/occupancy-system.ts`.
- [x] Move object footprint types and functions out of `utils/object-footprints.ts`; leave a temporary compatibility re-export only if needed.
- [x] Add `ui/src/modules/office/systems/placement-engine.ts` for candidate ranking, first-open-slot lookup, and shuffle/reflow policies.
- [ ] Add `ui/src/modules/office/systems/collision-system.ts` only if splitting collision reports from occupancy makes call sites clearer; otherwise keep collision in occupancy for the first pass.
- [x] Refactor `ui/src/providers/office-data-mapper.ts` to consume the placement engine instead of inline candidate scans.
- [x] Refactor `ui/src/components/debug/unified-grid-helper.tsx` to read engine footprint cells.
- [x] Refactor `ui/src/modules/office/components/team-cluster.tsx` so hit targets and metadata footprints derive from the same placement constants.
- [x] Refactor `ui/src/modules/office/controllers/draggable-controller.ts` or its owner seam so live drag validation calls the engine before persistence.
- [x] Decide whether CLI should import a shared root package or keep a mirrored CLI adapter; add parity tests either way.
- [x] Add tests for `occupancy-system`, `placement-engine`, CLI layout validation, and mapper generated layout stability.
- [x] Add `scripts/code_smell_check.sh` for line-count and ownership checks.
- [x] Update `scripts/pre_commit_check.sh` to run a fast staged smell check.
- [x] Update `scripts/pre_push_check.sh` to run the full smell check before build/typecheck.
- [x] Add package script such as `quality:smells`.
- [x] Document the office engine ownership in `ui/src/modules/office/README.md` and `ui/src/modules/office/AGENTS.md`.

## Agent Contract

- Open: `/office`, Settings > View, builder/debug grid, generated project table layout.
- Test hook: `npm run test:once -- occupancy placement office-placement office-data-provider a-star-pathfinding`
- Stabilize: browser smoke on `/office` with console capture and screenshot.
- Inspect: debug grid overlay should show claimed cells and no obvious overlaps for active tables/furniture.
- Key screens/states: Codex mode office, shuffled office, builder drag/move, dense generated project table set.
- Taste refs: compact office with readable table signs, visible aisles, no object overlap, no off-floor furniture.
- Expected artifacts: tests, screenshot, clean console JSON summary, pre-check output.
- Delegate with: reviewer lane for architecture/modularity review after implementation; QA lane for visual office pass.

## Evidence Checklist

- [x] Screenshot: office overview after generated placement.
- [x] Screenshot: debug occupancy cells enabled.
- [x] Snapshot: console capture with no placement/pathfinding/provider errors.
- [x] QA report linked: office visual/collision smoke.

## Proof Contract

- Metrics: none mechanical for visual beauty; mechanical checks are file-size thresholds, collision report count, off-floor count, and test pass/fail.
- Required tests: occupancy system unit tests, placement engine unit tests, CLI placement tests, mapper layout tests, existing pathfinding graceful fallback tests.
- Required checks: `npm run quality:smells`, targeted Vitest, `npm run --workspace @farplane/ui build --`.
- Required browser proof: `/office` screenshot plus console capture.
- Review rubric families: architecture boundaries, maintainability/modularity, UX-visible office correctness, regression risk.
- Hard gates: no provider crash, no object-object collisions in generated default layout, no object outside floor, no new source file over 500 lines without explicit ticket note.

## Quick Impl Plan

### Before

Placement has four overlapping owners:

- UI footprint utility calculates cells.
- Provider mapper chooses generated team/furniture positions.
- CLI placement has separate AABB math.
- Debug overlay colors cells from utility output.

This lets placement bugs recur because rendering, builder tools, CLI validation, and pathfinding do not share one canonical occupancy model.

### After

Office placement becomes an engine-style pipeline:

```text
OfficeObject[] + OfficeLayout
  -> OccupancySystem.buildGrid()
  -> CollisionSystem.report()
  -> PlacementEngine.findSlot()/shuffle()
  -> UI mapper, builder drag, CLI adapter, debug overlay, pathfinding
```

### Map

- `ui/src/modules/office/systems/occupancy-system.ts`
  - owns footprint constants, occupied cells, layout containment, collision reports, and pathfinding-ready walkability derivation
- `ui/src/modules/office/systems/placement-engine.ts`
  - owns candidate ordering, reflow policies, first legal slot
- `ui/src/modules/office/utils/object-footprints.ts`
  - becomes compatibility shim or is deleted after imports migrate
- `ui/src/providers/office-data-mapper.ts`
  - delegates placement to engine
- `cli/office-placement.ts`, `cli/office-layout-placement.ts`, `cli/office-arrange.ts`
  - converge on shared contract or parity adapter
- `scripts/code_smell_check.sh`
  - enforces line-count/ownership warnings

### Build Plan

1. Extract occupancy system from the current UI footprint utility and add direct tests.
2. Extract placement engine candidate selection from the provider mapper and add direct tests.
3. Migrate UI mapper/debug overlay/team cluster hit-target consumers.
4. Wire builder drag validation to the engine contract.
5. Align CLI placement with the same contract or add parity tests for the mirrored CLI adapter.
6. Add smell checks and package scripts.
7. Update docs and module ownership notes.
8. Run targeted tests, build, and browser QA.

### Verification

- `npm run quality:smells`
- `npm run test:once -- occupancy placement office-placement office-data-provider a-star-pathfinding`
- `npm run --workspace @farplane/ui build --`
- Browser smoke: `/office`, console capture, screenshot, debug occupancy overlay.

## Goal Architecture

- Ticket: `tickets/done/TKT-004-office-engine-occupancy-and-quality-gates.md`
- Trigger: `active_goal` after user approval; ticket should move to `building`
- Metric / Feedback Provider: hybrid mechanical + review
  - mechanical: tests/build/smell checks/collision count
  - review: architecture and modularity review
- Drift Policy: each turn must compare work against this ticket, stop if it expands into unrelated scene redesign, and log any required split as a follow-up ticket.
- Next Owner: `$work` or direct `$impl` once approved.

## Native Goal Prompt Draft

```text
/goal Task: Implement TKT-004 in /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI. Build a modular office occupancy/collision/placement engine and quality gates exactly as described in tickets/done/TKT-004-office-engine-occupancy-and-quality-gates.md. Keep the first pass focused on engine ownership, placement consumers, tests, docs, and pre-commit/pre-push smell checks; do not redesign unrelated office visuals or agent behavior.

Logging: Before ending each turn, update the ticket with completed steps, evidence paths, blockers, and the next action.

Metric: Mechanical gates are npm run quality:smells, targeted Vitest for occupancy/placement/office-data/pathfinding, UI production build, collision/off-floor count for generated office layout, and browser console/screenshot proof. Completion also requires architecture/modularity review.

After each turn: Re-read the ticket acceptance criteria, mark progress, check for scope drift, and either continue, create a follow-up ticket for real split scope, or stop only when proof is complete or a genuine blocker is documented.
```

## Build Notes

- Do not start by adding more placement heuristics inside `office-data-mapper.ts`.
- Do not hide new collision behavior inside React components.
- Prefer pure functions and tests before wiring scene components.
- Treat CLI/UI sharing as a design point: either literal shared code or a deliberately mirrored adapter with parity tests.
- Pathfinding bridge: `buildOfficeWalkabilityGrid()` now derives a pathfinding-ready walkability matrix from the same office layout and object footprint contract. The current A* scene adapter can wire to that API next without reinterpreting furniture via Three.js bounding boxes.

## QA Reconciliation

- AC-1: `PROVABLE` via `ui/src/modules/office/systems/occupancy-system.ts` and occupancy-system tests.
- AC-2: `PROVABLE` via migrated imports and `quality:smells` ownership gate.
- AC-3: `PROVABLE` via `office-data-mapper.ts` reservation usage and browser runtime collision summary.
- AC-4: `PROVABLE` via builder placement, drag, and transform validation consumers.
- AC-5: `PROVABLE` via CLI/UI footprint parity test while the CLI remains a mirrored adapter.
- AC-6: `PROVABLE` via debug occupancy overlay screenshot and `unified-grid-helper.tsx`.
- AC-7: `PROVABLE` via `buildOfficeWalkabilityGrid()` and occupancy-system tests.
- AC-8: `PROVABLE` via `scripts/code_smell_check.sh`, pre-commit/pre-push hooks, and `quality:smells`.
- AC-9: `PROVABLE` via targeted Vitest run covering 31 tests.

## Artifact Links

- Browser/debug proof: `tickets/done/TKT-004-artifacts/office-engine-proof.md`
- Debug occupancy screenshot: `tickets/done/TKT-004-artifacts/office-debug-occupancy-proof.png`

## User Evidence

- Hero screenshot: `tickets/done/TKT-004-artifacts/office-debug-occupancy-proof.png`
- Supporting evidence: `tickets/done/TKT-004-artifacts/office-engine-proof.md`
- QA report: `tickets/done/TKT-004-artifacts/office-engine-proof.md`
- Final verdict: passed.

## Required Evidence

- [x] Unit/integration/e2e tests pass as applicable.
- [x] Typecheck/build passes.
- [x] Smell checks pass or produce accepted warnings.
- [x] Browser office proof is captured.

## Progress Log

### 2026-06-12

- Created `ui/src/modules/office/systems/occupancy-system.ts` as first-class owner for footprints, cells, layout containment, collision reports, and `canPlaceOfficeObject`.
- Added `buildOfficeWalkabilityGrid()` so pathfinding can derive walkability from office layout plus occupancy without duplicating object obstacle assumptions.
- Created `ui/src/modules/office/systems/placement-engine.ts` for placement reservations, candidate ordering, legal-slot selection, and fallback placement.
- Converted `ui/src/modules/office/utils/object-footprints.ts` into a compatibility shim.
- Migrated generated office placement in `ui/src/providers/office-data-mapper.ts` to the placement engine.
- Migrated debug occupancy overlay imports to the occupancy system.
- Added builder validation through `canPlaceOfficeObjectAtPosition` for drag, exact transform save, and coordinate placement preview.
- Added CLI/UI footprint parity test while keeping CLI as a mirrored adapter for this pass.
- Added `scripts/code_smell_check.sh`, `quality:smells`, staged pre-commit smell check, and pre-push smell check.
- Documented office engine ownership in `ui/src/modules/office/README.md` and `ui/src/modules/office/AGENTS.md`.
- Evidence:
  - `npm run test:once -- occupancy placement-engine office-object-placement office-placement office-data-provider a-star-pathfinding` passed: 6 files, 30 tests.
  - `npm run quality:smells` passed with 38 legacy large-file warnings.
  - `npm run --workspace @farplane/ui build --` passed.
  - Browser smoke on `/office` passed with no page errors, no bad responses, no relevant console messages.
  - Runtime occupancy summary: `objectCount=17`, `outsideLayoutCount=0`, `collisionReportCount=0`.
  - Screenshot: `/tmp/farplane-office-engine-proof.png`.
- Final review/modularity pass completed:
  - Old footprint import grep clean.
  - Provider raw collision-helper grep clean.
  - `git diff --check` clean.

### 2026-06-12 Final Proof Pass

- Added `buildOfficeWalkabilityGrid()` test coverage. Focused Vitest now passes: 6 files, 31 tests.
- Re-ran `npm run quality:smells`: passed with 38 legacy large-file warnings.
- Re-ran `npm run --workspace @farplane/ui build --`: passed with the existing Vite chunk-size warning.
- Browser proof on `/office` with debug occupancy cells captured:
  - Screenshot: `tickets/done/TKT-004-artifacts/office-debug-occupancy-proof.png`
  - QA note: `tickets/done/TKT-004-artifacts/office-engine-proof.md`
  - Runtime engine summary: `objectCount=17`, `outsideLayoutCount=0`, `collisionReportCount=0`.
- Final review/modularity pass:
  - `rg "modules/office/utils/object-footprints" ui/src cli -n`: no matches.
  - `rg "countObjectFootprintCollisions|objectFootprintsCollide|isObjectFootprintInsideLayout" ui/src/providers -n`: no matches.
  - `git diff --check`: clean.
