---
ticket_id: TASK-0005
program_version: 1
mode: active_goal
metric_provider: hybrid
drift_policy: inline
budget: one focused implementation window; use additional turns until done or genuinely blocked
created_at: 2026-06-22
updated_at: 2026-06-22
---

# TASK-0005 Program

## Goal Shape
`active_goal`: this is a focused implementation and proof loop. Continue until the layout meets the numeric and visual bar, or until progress contains a concrete blocker with measured geometry.

## Files
- `tickets/TASK-0005/ticket.md`
- `tickets/TASK-0005/program.md`
- `tickets/TASK-0005/progress.md`
- `tickets/TASK-0005/generated-goal-prompt.md`
- `ui/src/providers/office-data-mapper.ts`
- `ui/src/providers/office-data-provider.test.ts`
- `ui/src/modules/office/systems/occupancy-system.ts`
- `ui/src/modules/office/lib/office-layout-quality.ts`
- `ui/src/modules/office/lib/office-space-stats.ts`
- `ui/src/modules/office/lib/office-section-walls.ts`
- `ui/src/modules/office/lib/office-area-layout.ts`

## Execution Rules
- Evidence is mandatory after each meaningful implementation pass.
- Do not stop at "better"; the metric is `<20%` live empty area plus graph reachability and visible walls.
- Do not remove furniture, teams, employees, generated walls, or persisted POIs to improve the score.
- Use the same occupancy/footprint contract for packing, collision, POI graph, and tests.
- Treat furniture, team clusters, and skill-bound objects as key office destinations.
- Generated dividers should be wall-colored and visible, not glass-only debug pieces.
- Keep layout code modular; new graph or compactness helpers should live in office layout/quality modules when reusable.
- Leave unrelated dirty worktree files untouched.

## Metric / Feedback Provider
- Mechanical:
  - Focused Vitest suite passes.
  - Root typecheck passes.
  - POI graph reports all POIs reachable.
  - Layout stats report empty area `< 0.20`.
- Manual/visual:
  - Browser screenshot shows generated walls visibly separating qualifying sections.
  - HUD text capture shows `EMPTY < 20%`.
- Human:
  - Final evidence must be readable by the operator without asking for another screenshot.

## Drift Policy
Before each stop, compare actual results against the `Done / Proof` block in `ticket.md`.
If empty area remains `>= 20%`, continue unless a measured geometry blocker is logged.
If generated walls are not visible in the screenshot, continue unless the current data set has no qualifying section and a separate forced fixture screenshot proves the renderer.

## Stop Policy
Stop complete only when source changes are scoped, tests pass, typecheck passes, the browser probe shows `<20%` empty area, generated walls are visible, POI graph reachability is proven, progress is updated, and a scoped commit is created.
