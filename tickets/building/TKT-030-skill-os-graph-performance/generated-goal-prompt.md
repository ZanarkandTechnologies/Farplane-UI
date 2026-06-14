---
ticket: TKT-030
title: Generated native goal prompt
created_at: 2026-06-14
---

# Native Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/building/TKT-030-skill-os-graph-performance/ticket.md
- tickets/building/TKT-030-skill-os-graph-performance/program.md
- tickets/building/TKT-030-skill-os-graph-performance/progress.md
- ui/src/modules/skills-studio/components/skill-os/skill-os-mini-app.tsx
- ui/src/modules/skills-studio/components/skill-os/skill-graph-canvas.tsx
- ui/src/modules/skills-studio/components/skill-os/skill-graph-svg-canvas.tsx
- ui/src/modules/skills-studio/components/skill-os/skill-graph-layout.ts
- ui/vite.config.ts
- ui/package.json
- package.json
- package-lock.json

Task: Complete the desired outcomes defined across the listed files. Preserve
TKT-030 scope: optimize Skill OS graph runtime work, keep Reagraph preferred
where viable, keep D3/SVG fallback reliable, and do not redesign the UI.

Logging: Before ending each turn, append a compact structured entry to
progress.md if ticket state, proof, blockers, or implementation path changed.

Metric: Satisfy the Done / Proof and mechanical/browser metric declared in
ticket.md and program.md.

After each turn: Compare progress against the listed files, run inline drift
check, continue within the current time window if useful, otherwise stop
complete or stop blocked with attempted paths and one missing input.
```
