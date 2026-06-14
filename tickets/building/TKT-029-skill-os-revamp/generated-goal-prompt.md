---
ticket: TKT-029
artifact: generated-goal-prompt
created_at: 2026-06-14
---

# Native Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/building/TKT-029-skill-os-revamp/ticket.md
- tickets/building/TKT-029-skill-os-revamp/program.md
- tickets/building/TKT-029-skill-os-revamp/progress.md
- ui/src/components/hud/office-menu.tsx
- ui/src/modules/office/components/skills-panel.tsx
- ui/src/modules/office/components/use-skills-panel-controller.ts
- ui/src/modules/office/components/skills-panel-files-tab.tsx
- ui/src/store/app-store.ts
- ui/vite.config.ts
- /Users/kenjipcx/.codex/skills/skill-maintenance/graph/index.html
- /Users/kenjipcx/.codex/skills/skill-maintenance/graph/skill-graph.json
- /Users/kenjipcx/.codex/skills/skill-maintenance/graph/skill-docs.json

Task: Complete TKT-029. Replace the current tabbed Skill OS experience with a
graph-first mini app that preserves the Skill Maintenance graph viewer
behavior inside Farplane chrome. The Skill OS graph must be the primary canvas,
with sidebar selection syncing to graph focus and graph node clicks opening a
skill detail overlay. Do not show Evals, Harness, or the legacy detail tab
strip inside Skill OS.

Logging: Before ending each turn, append a compact structured entry to
`tickets/building/TKT-029-skill-os-revamp/progress.md` with progress, changed
files, verification, metric sample, drift verdict, next action, and blockers.

Metric: Satisfy the acceptance criteria and proof plan in `ticket.md` and the
mechanical/browser evidence metric in `program.md`.

After each turn: Compare current work against the listed files, especially the
operator correction in `ticket.md`. Continue within the current execution
window while useful. Stop complete only when screenshot proof, endpoint
snapshot, focused checks, and final console log are present. Stop blocked only
after repeated meaningful attempts identify the same blocker.

Budget: one focused implementation pass; local Node/Vite/Vitest/Playwright;
no spend; no planned subagents.
```
