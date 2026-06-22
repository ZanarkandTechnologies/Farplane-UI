---
ticket_id: TASK-0005
title: Optimize office treemap packing, visible dividers, and graph walkability
phase: implementation
status: building
owner: Farplane UI
claimed_by: Codex
priority: high
depends_on: []
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-06-22
updated_at: 2026-06-22
next_action: implement POI graph walkability and compact layout proof until the office is under 20 percent empty with visible generated walls
last_verification: live probe currently shows 28 percent empty and generated walls are not visibly proven
---

# TASK-0005: Optimize Office Treemap Packing, Visible Dividers, And Graph Walkability

## Summary
The office layout still fails the product bar: generated section walls are not visibly obvious, the live HUD still reports 28% empty space after the latest packing pass, and the layout engine lacks an explicit graph contract that every key point of interest remains reachable by a minimal walkable route. The next pass must treat office layout as a game-layout problem: pack objects tightly, build a POI traversal graph, preserve visible dividers, and prove the result with screenshots plus numeric evidence.

## Scope
- In:
  - Define office key points of interest from all generated/persisted team clusters, default/persisted furniture, skill-bound objects, and generated dividers when relevant.
  - Build or expose a pure graph/pathing quality check that verifies every POI has a reachable path through the layout.
  - Update treemap/project packing so room empty area is below 20% in the live Farplane office when possible.
  - Keep generated section walls visible and styled like the outer walls; prove at least one generated wall renders when section criteria are met.
  - Add focused tests for compactness, divider visibility/collision, and POI graph connectivity.
  - Capture browser evidence after implementation: screenshot, HUD stats, and if possible a small debug dump of POI graph reachability.
  - Commit only scoped source/test changes.
- Out:
  - Rewriting the full renderer or replacing the current office data provider.
  - Persisting destructive layout changes to user sidecar files unless required and explicitly noted in progress.
  - Hiding the problem by removing furniture, teams, POIs, or generated walls.
  - Declaring success from unit tests alone without screenshot/HUD evidence.

## Delta
- Before:
  - Auto-fit can choose a layout that remains 28% empty in the live project.
  - Generated walls can be clipped/nudged by collision logic, but there is no visual proof they appear clearly in the office.
  - Walkability is a percent metric, not an explicit graph that proves all important office destinations are mutually reachable.
- After:
  - The layout fitter selects or constructs a room whose live HUD empty area is less than 20%, unless progress logs a concrete proof that current objects make that mathematically impossible.
  - Generated section dividers are visible in browser screenshots and do not collide with tables.
  - A POI graph/pathing check proves every key office object can be reached from the active agent/team cluster area.

## Program
```text
vars:
  ticket = tickets/TASK-0005/ticket.md
  program = tickets/TASK-0005/program.md
  progress = tickets/TASK-0005/progress.md
  mapper = ui/src/providers/office-data-mapper.ts
  mapper_tests = ui/src/providers/office-data-provider.test.ts
  occupancy = ui/src/modules/office/systems/occupancy-system.ts
  quality = ui/src/modules/office/lib/office-layout-quality.ts
  stats = ui/src/modules/office/lib/office-space-stats.ts

program:
  ground(current_layout) -> explain why live HUD is 28% and why walls are not visible
  define_pois(objects) -> furniture + team clusters + skill-bound objects + generated walls/debug anchors
  graph_check(layout, objects, pois) -> connected paths and shortest route evidence
  optimize_packing(layout) -> emptyPercent < 0.20 without breaking POI graph
  verify_walls(layout) -> generated dividers visible, colored like walls, and collision-free
  browser_probe() -> screenshot + HUD text + console/error check
  commit_scoped_changes()
```

## Done / Proof
```text
done_when:
  - live office HUD empty area is < 20% after a cold dev-server probe
  - every POI derived from teams/furniture/skill-bound objects is graph-reachable
  - generated section dividers are visible in a browser screenshot when section criteria are present
  - generated dividers use the same wall color family as surrounding office walls
  - generated dividers do not collide with team clusters or furniture
  - compactness does not delete tables, employees, furniture, or persisted POIs
  - focused tests and typecheck pass
  - final answer includes screenshot path, HUD numbers, test output summary, and commit hash

proof:
  checks:
    - npm run test:once -- ui/src/providers/office-data-provider.test.ts ui/src/modules/office/lib/office-area-layout.test.ts ui/src/modules/office/lib/office-layout-quality.test.ts ui/src/modules/office/lib/office-space-stats.test.ts ui/src/modules/office/systems/occupancy-system.test.ts
    - npm run typecheck:root -- --pretty false
  manual:
    - cold-start `npm run ui -- --host 127.0.0.1 --port 5200`
    - Playwright screenshot saved under tmp/probes/
    - HUD text capture showing `EMPTY < 20%`
    - POI graph/debug evidence showing all POIs reachable or listing exact blockers
  review:
    - rubric: layout algorithm is modular, data-driven, collision-aware, and does not mutate user sidecar state accidentally
      required_tas: self-review plus evidence-first final response
  evidence:
    - append every probe result to tickets/TASK-0005/progress.md
    - final answer must embed or link the screenshot evidence
    - commit hash after successful scoped commit
```

## State
- `next_action:` create native Goal, inspect current geometry, implement POI graph check, optimize compact fit, prove with browser evidence.
- `blocked:` false
- `latest_verification:` current known evidence is insufficient: 28% empty and no visible generated-wall proof.
- `result:` pending

## Links
- `program:` tickets/TASK-0005/program.md
- `progress:` tickets/TASK-0005/progress.md
- `generated_goal_prompt:` tickets/TASK-0005/generated-goal-prompt.md
- `refs:` ui/src/providers/office-data-mapper.ts, ui/src/providers/office-data-provider.test.ts, ui/src/modules/office/systems/occupancy-system.ts, ui/src/modules/office/lib/office-layout-quality.ts, ui/src/modules/office/lib/office-space-stats.ts
