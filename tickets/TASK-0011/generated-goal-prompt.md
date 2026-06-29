---
ticket_id: TASK-0011
created_at: 2026-06-25T01:03:22+0800
owner: Codex
---

# Generated Goal Prompt

```text
/goal Run the Team Panel Goals campaign prototype end to end.

Files:
- tickets/TASK-0011/ticket.md
- tickets/TASK-0011/program.md
- tickets/TASK-0011/progress.md
- ui/src/modules/team-workspace/components/operator-intelligence-tabs.tsx
- ui/src/modules/team-workspace/components/team-panel.tsx

Objective:
Implement the first Goals tab prototype as a source-honest campaign surface for
autonomous work tracking. Render active quest, campaign map, side objectives,
progress, and trophy shelf. Keep completed task trophies visible. Do not invent
completed-goal state or weekly progress claims.

Budget:
One focused implementation pass plus verification. Do not broaden into the full
Team Panel tab collapse unless explicitly asked.

Proof:
- npm run test:once -- team-panel
- npm run ui:build
- git diff --check -- ui/src/modules/team-workspace tickets/TASK-0011
- browser screenshot at .farplane/proof/TASK-0011-goals-campaign-tab.png

Logging:
Append meaningful state changes and proof results to
tickets/TASK-0011/progress.md before closing the Goal.
```
