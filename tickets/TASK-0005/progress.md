---
ticket_id: TASK-0005
created_at: 2026-06-22
updated_at: 2026-06-22
---

# TASK-0005 Progress

## 2026-06-22
- Created Goal Packet after operator rejected the prior pass as insufficient.
- Current known evidence from prior pass:
  - Live HUD before latest packing work: `EMPTY 49%`.
  - Live HUD after latest committed pass: `EMPTY 28%`.
  - Requirement remains unmet because target is `<20%`.
  - Generated walls were not visibly proven to the operator.
- Goal intent: optimize the office as a game-layout graph problem, not only as an empty-area score. Every furniture/team/skill-bound POI must be reachable through a minimal walkable path, generated walls must be visible, and final response must include evidence without being asked.
- Implemented: added explicit POI graph reporting in `office-layout-quality.ts` with named POI nodes, disconnected IDs, and average route length.
- Implemented: changed office auto-fit to consider graph-shaped tile masks, route corridors between object access tiles, preserve non-rectangular tile masks during trim, and prune only empty tiles that do not disconnect POIs.
- Verification: focused suite passed: `npm run test:once -- ui/src/providers/office-data-provider.test.ts ui/src/modules/office/lib/office-area-layout.test.ts ui/src/modules/office/lib/office-layout-quality.test.ts ui/src/modules/office/lib/office-space-stats.test.ts ui/src/modules/office/systems/occupancy-system.test.ts` -> 5 files / 40 tests passed.
- Verification: `npm run typecheck:root -- --pretty false` passed.
- Browser proof: launched `npm run ui -- --host 127.0.0.1 --port 5200` and captured `tmp/probes/task-0005-final-under-20.png`; HUD showed `EMPTY 19%`, `AGENTS 7`, `WALK 35%`.
- Graph proof from `tmp/probes/task-0005-live-office-state.json`: exact empty percent `0.1888111888111888`, POI count `16`, disconnected count `0`, average POI path length `9.533333333333333`.
- Generated wall proof: launched Chromium with SwiftShader flags and injected one in-memory generated `office-divider` probe without persisting sidecar state; captured `tmp/probes/task-0005-generated-divider-visible.png`. Store readback confirmed object count changed `19 -> 20`, metadata had `generated: true`, `sectionBasis: area-treemap`, `sectionType: project-subprojects`, `wallColor: #ede5d6`, and `capColor: #ede5d6`.
