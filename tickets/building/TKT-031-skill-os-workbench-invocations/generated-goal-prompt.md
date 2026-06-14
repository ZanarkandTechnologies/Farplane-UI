---
ticket: TKT-031
artifact: generated-goal-prompt
created_at: 2026-06-14
---

# Native Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/building/TKT-031-skill-os-workbench-invocations/ticket.md
- tickets/building/TKT-031-skill-os-workbench-invocations/program.md
- tickets/building/TKT-031-skill-os-workbench-invocations/progress.md
- tickets/building/TKT-025-skill-invocation-listener-hook/ticket.md
- tickets/building/TKT-029-skill-os-revamp/ticket.md
- tickets/building/TKT-030-skill-os-graph-performance/ticket.md
- ui/src/modules/skills-studio/components/skill-os/skill-os-mini-app.tsx
- ui/src/modules/skills-studio/components/skill-os/skill-detail-overlay.tsx
- ui/src/modules/skills-studio/components/skill-os/skill-sidebar.tsx
- ui/src/modules/skill-invocations/skill-invocations-panel.tsx

Task: Complete TKT-031. Add Skill OS top-level tabs for Skill Tree,
Invocations, and Standards / Rollout. Keep the existing graph-first Skill Tree.
Reuse the existing TKT-025 skill invocation telemetry source instead of adding a
new hook/backend. Upgrade selected-skill full page into a tabbed workbench with
special renderers for extracted todos, QA tasks, checklist, references, file
graph, evals, UI mentions, and raw files. Do not change or fix Reagraph in this
Goal.

Logging: Before ending each turn, append a compact structured entry to
`progress.md` with changed files, verification, drift verdict, next action, and
blockers.

Metric: Satisfy the Done / Proof checklist in `ticket.md`; browser screenshots
must prove Skill Tree, Invocations, Standards / Rollout, and selected-skill
workbench states. Focused formatter/tests should pass; document known workspace
typecheck drift if it remains.

After each turn: Compare progress against the listed files, keep implementation
inside the Skill OS and Skill Invocations module boundaries, continue if useful,
otherwise stop complete or blocked with attempted paths and one missing input.
```
