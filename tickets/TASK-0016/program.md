---
ticket_id: TASK-0016
kind: goal-program
status: active
created_at: 2026-06-25
updated_at: 2026-06-25
---

# Goal Program

## Goal
Implement a manifest-backed `farplane-framework-core` graph projection and make Harness OS Map render it directly.

## Files
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0016/ticket.md`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0016/program.md`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0016/progress.md`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane/farplane/manifest.json`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/skill-maintenance/scripts/graph_projection_config.py`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/skill-maintenance/scripts/generate_graph_projection.py`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/skill-maintenance/scripts/graph_projection.py`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/skill-maintenance/scripts/generate_harness_graph.py`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/ui/src/modules/harness-os/use-harness-os-data.ts`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/ui/src/modules/harness-os/harness-os-model.ts`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/ui/src/modules/harness-os/harness-os-panel.tsx`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/ui/src/modules/harness-os/harness-os-types.ts`

## Budget
- Time: current Codex turn.
- Subagents: none required unless QA/review becomes ambiguous.
- Spend/deploy/destructive: none.

## Metric
Mechanical and visual:
- Projection check passes.
- UI type/build passes.
- Harness OS Map browser screenshot renders projection from generated graph.

## Drift Policy
Stay within manifest-backed Framework Core projection and Harness OS Map rendering. Do not refactor unrelated template rollout, skill rollout, or office navigation surfaces.

## Proof Route
Main agent may run mechanical checks. Browser screenshot required for user-visible proof. Completion requires ticket progress update and final evidence path.

## Native Goal Prompt

```text
/goal
Files:
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0016/ticket.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0016/program.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0016/progress.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/farplane/manifest.json
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/skill-maintenance/scripts/graph_projection_config.py
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/skill-maintenance/scripts/generate_graph_projection.py
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/skill-maintenance/scripts/graph_projection.py
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/skill-maintenance/scripts/generate_harness_graph.py
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/ui/src/modules/harness-os/use-harness-os-data.ts
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/ui/src/modules/harness-os/harness-os-model.ts
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/ui/src/modules/harness-os/harness-os-panel.tsx
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/ui/src/modules/harness-os/harness-os-types.ts

Task: Implement TASK-0016 end to end. Farplane emits a manifest-backed farplane-framework-core graph projection. Harness OS Map renders that projection directly and no longer filters by hardcoded keywords.

Logging: Append compact progress to progress.md after major phases and update ticket.md State/Done Proof before completion.

Metric: projection generation/check, UI typecheck/build, git diff checks, and browser screenshot evidence.

Drift: If work expands beyond manifest graph config, projection generation, and Harness OS Map rendering, stop and record a blocker.

Proof route: run mechanical checks and capture Harness OS Map screenshot. Final evidence must include the screenshot path.
```

## Approval
Approved by operator request to create and run the goal end to end.
