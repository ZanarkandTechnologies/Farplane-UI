---
ticket: TKT-023
title: Native Goal prompt
status: generated
created_at: 2026-06-13
---

# Native Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/building/TKT-023-skill-os-evals-harness-redesign/ticket.md
- tickets/building/TKT-023-skill-os-evals-harness-redesign/program.md
- tickets/building/TKT-023-skill-os-evals-harness-redesign/progress.md
- ui/src/components/hud/office-menu.tsx
- ui/src/modules/office/components/employee/index.tsx
- ui/src/modules/office/components/skills-panel.tsx
- ui/src/modules/office/components/skills-panel-sidebar.tsx
- ui/src/modules/office/components/use-skills-panel-controller.ts
- ui/src/modules/office/components/skills-panel-data.ts
- ui/src/modules/office/components/skills-panel.runtime.ts
- ui/skill-studio-state.ts
- ui/vite.config.ts

Task: Implement TKT-023. Create the corrected global Skill OS, Evals, and
Harness entrypoint model. Add adapter capability gating so Codex mode hides the
employee radial skill action while OpenClaw can keep per-agent skill equip
behavior behind capabilities. Skill OS must be a skill control plane: skills
list, skill-to-skill call/routing graph only, registry/template/rollout/audit
status, and selected skill special-file viewer. Evals must be a separate global
entrypoint for eval runs/suites/hardcases while Skill OS only renders the
selected skill's local eval file. Harness must be a separate global entrypoint
for the full harness map and must not be mixed into the Skill OS graph.

Logging: Before ending each turn, append a compact structured entry to
`tickets/building/TKT-023-skill-os-evals-harness-redesign/progress.md` with
changed files, verification, screenshots, drift verdict, next action, and
blockers.

Metric: Satisfy the Done / Proof and Evidence Checklist in
`tickets/building/TKT-023-skill-os-evals-harness-redesign/ticket.md`. Mechanical
checks are not enough. Browser screenshot evidence is required for Codex radial
skill action hidden, global Skill OS, Skill OS skill-to-skill graph, selected
skill special-file viewer, selected skill local eval rendering, global Evals,
and Harness entrypoint.

After each turn: Compare progress against the listed files and the corrected
model. If implementation starts mixing harness docs/files into Skill OS graph or
putting global eval operations inside Skill OS, stop and correct. Continue
within the current time/budget window while useful implementation or proof work
remains. Stop complete only when screenshots and checks are recorded. Stop
blocked only after the same blocker repeats for three consecutive attempts and
one missing input is named.

Budget: one focused implementation window; subagents allowed for visual QA or
review; no spend; no deployment.
```
