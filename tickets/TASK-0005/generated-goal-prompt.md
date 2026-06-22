---
ticket_id: TASK-0005
created_at: 2026-06-22
updated_at: 2026-06-22
---

# Native Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/TASK-0005/ticket.md
- tickets/TASK-0005/program.md
- tickets/TASK-0005/progress.md
- tickets/TASK-0005/generated-goal-prompt.md
- ui/src/providers/office-data-mapper.ts
- ui/src/providers/office-data-provider.test.ts
- ui/src/modules/office/systems/occupancy-system.ts
- ui/src/modules/office/lib/office-layout-quality.ts
- ui/src/modules/office/lib/office-space-stats.ts
- ui/src/modules/office/lib/office-section-walls.ts
- ui/src/modules/office/lib/office-area-layout.ts

Task: Complete TASK-0005. Optimize the office layout as a compact, graph-walkable game space. The live office must show `EMPTY < 20%`, generated section walls must be visibly rendered and wall-colored when section criteria are present, and every key point of interest derived from teams, furniture, and skill-bound objects must be reachable through the walkability graph. Do not declare success from tests alone and do not remove objects to improve the score.

Logging: Before ending each turn, append a compact structured entry to `tickets/TASK-0005/progress.md` with changed files, measured HUD empty percentage, POI graph result, screenshot path, verification commands, and blockers.

Metric: Use the hybrid metric in `program.md`: focused tests, root typecheck, POI graph reachability, live HUD `EMPTY < 20%`, visible generated walls in screenshot, and operator-readable evidence.

After each turn: Compare progress against `ticket.md` Done / Proof. Continue if empty area is still `>=20%`, if generated walls are not visible, or if POI reachability is not proven. Stop complete only after proof is logged, screenshot evidence exists, checks pass, and a scoped commit is created. Stop blocked only with a measured geometry blocker and attempted alternatives.

Budget: one focused implementation window; use additional turns until done or genuinely blocked. Leave unrelated dirty worktree files untouched.
```
