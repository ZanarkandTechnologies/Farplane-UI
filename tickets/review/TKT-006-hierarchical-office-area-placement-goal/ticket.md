# TKT-006: Hierarchical office area placement

## Status

- state: `review`
- owner: codex
- assignee:
- dependencies:
- location: `tickets/review/TKT-006-hierarchical-office-area-placement-goal`
- enter when: operator wants teams placed by company/project folder hierarchy instead of first-open-slot clustering
- leave when: Farplane UI can derive visible office areas from project hierarchy, place team clusters inside their assigned areas, and prove the result with tests plus office screenshots
- blockers:
- spawned follow-ups:
- complexity: `L`

## Description

The office currently places project team clusters through deterministic open-slot placement, which makes teams valid but does not communicate ownership, department hierarchy, or nested project structure. The operator wants a more legible and playful office: Zanarkand Technologies should own a visible area, Farplane should read as a nested department/project area, and Farplane UI / related Codex project teams should cluster inside that hierarchy.

## Goal

Implement a hierarchy-aware placement layer for the office. The layer should derive organization/project/folder areas from the company model and Codex project paths, allocate office floor regions with a treemap-style space partition, render visible area boundaries/labels, and use those areas as preferred anchors for team-cluster placement while preserving the existing collision and layout safeguards.

## Acceptance Criteria

- [ ] AC-1: A pure area-layout module derives a stable hierarchy from departments, projects, and Codex project paths, including nested path relationships such as `Zanarkand Technologies -> Farplane -> Farplane UI`.
- [ ] AC-2: The area-layout module allocates bounded office regions using a deterministic treemap-style partition of the live office layout bounds, with weights based on team/thread/activity counts and stable output for tests.
- [ ] AC-3: `office-data-mapper` uses project area centers as preferred team-cluster anchors before falling back to existing placement/collision logic.
- [ ] AC-4: The office scene renders visible area ownership cues: translucent floor tints, boundary/barrier hints, and labels/flags for at least top-level and project-level areas.
- [ ] AC-5: The office view shows Farplane-related teams grouped together under a Zanarkand/Farplane area instead of scattered by first-open-slot order.
- [ ] AC-6: Tests cover hierarchy derivation, area allocation, team preferred anchors, and fallback behavior when areas are too small or occupied.
- [ ] AC-7: Browser QA captures desktop office screenshots proving visible areas, nested labels, and non-overlapping team clusters.

## Agent Contract

- Open: inspect `ui/src/providers/office-data-mapper.ts`, `ui/src/modules/runtime/lib/codex-app-server/normalizers.ts`, `ui/src/modules/office/lib/office-layout.ts`, `ui/src/modules/office/systems/placement-engine.ts`, `ui/src/modules/office/scene/scene-contents.tsx`, `ui/src/modules/office/scene/office-room-shell.tsx`, `ui/src/modules/office/components/team-cluster.tsx`, and CLI team placement helpers.
- Test hook: focused Vitest targets for the new pure layout module and mapper tests; targeted Biome lint on changed files; Playwright screenshot of `/office`.
- Stabilize: keep the algorithm pure and deterministic; keep collision/layout validation in the existing placement engine; do not reposition persisted manually moved clusters unless the cluster lacks a usable persisted position or the user explicitly chooses auto-arrange.
- Inspect: office layout bounds, tile mask behavior, team-cluster footprint metadata, Codex project path grouping, current office object rendering pipeline, and existing dev screenshot helpers.
- Key screens/states: `/office` with Codex runtime adapter, multiple project teams, builder mode off, hover/readability with labels visible enough but not cluttered.
- Taste refs: isometric office districts, low glass partitions, colored floor zones, small flags/signboards, and existing Farplane office visual language.
- Expected artifacts: `office-area-layout` pure module, tests, mapper integration, scene overlay renderer, screenshots, and updated ticket/progress notes.
- Delegate with: QA/reviewer lane if visual proof or algorithm review grows beyond one focused implementation pass.

## Evidence Checklist

- [ ] Screenshot: `/office` showing Zanarkand/Farplane area boundaries and labels.
- [ ] Screenshot: `/office` showing Farplane UI/team clusters grouped inside the nested area.
- [ ] Snapshot: focused area-layout and mapper test output.
- [ ] Snapshot: targeted lint/type evidence for changed files.
- [ ] QA report linked:

## Build Notes

- Recommended algorithm: use a squarified-treemap-inspired recursive rectangle partition for hierarchy ownership, then place teams inside leaf/project rectangles.
- External grounding:
  - D3 treemap docs: `https://d3js.org/d3-hierarchy/treemap`
  - Squarified Treemaps paper: `https://vanwijk.win.tue.nl/stm.pdf`
  - Graphviz layout engines: `https://graphviz.org/docs/layouts/`
  - Spatial partitioning reference: `https://gameprogrammingpatterns.com/spatial-partition.html`
- Why treemap first: area ownership is the core product signal. Force-directed graphs are better for relationships, and quadtrees are better as spatial indexes than as the first visual allocator.
- MVP scope:
  - derive area nodes from company departments/projects plus project path ancestry
  - allocate approximate rectangles over the office layout bounds
  - render floor tints and labels
  - use area centers as preferred anchors for generated/unmoved team clusters
- Non-goals:
  - full persistent area editor
  - arbitrary graph edge routing
  - replacing the occupancy/placement engine
  - changing Codex thread status sync behavior

## QA Reconciliation

- AC-1: `PASS | FAIL | NOT PROVABLE`
- AC-2: `PASS | FAIL | NOT PROVABLE`
- AC-3: `PASS | FAIL | NOT PROVABLE`
- AC-4: `PASS | FAIL | NOT PROVABLE`
- AC-5: `PASS | FAIL | NOT PROVABLE`
- AC-6: `PASS | FAIL | NOT PROVABLE`
- AC-7: `PASS | FAIL | NOT PROVABLE`
- Screen: `PASS | FAIL | NOT PROVABLE`
- Evidence item: `CAPTURED | MISSING`

## Artifact Links

- Program: `tickets/review/TKT-006-hierarchical-office-area-placement-goal/program.md`
- Progress: `tickets/review/TKT-006-hierarchical-office-area-placement-goal/progress.md`
- Native Goal Prompt: `tickets/review/TKT-006-hierarchical-office-area-placement-goal/goal-prompt.md`

## User Evidence

- Hero screenshot:
- Supporting evidence:
- QA report:
- Final verdict:

## Required Evidence

- [ ] Unit/integration/e2e tests pass (as applicable)
- [ ] Typecheck or narrow touched-file type evidence passes
- [ ] Lint passes
- [ ] Browser screenshot proof captured
