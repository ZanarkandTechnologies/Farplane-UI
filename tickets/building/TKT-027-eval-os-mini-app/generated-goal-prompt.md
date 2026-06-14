---
ticket: TKT-027
artifact: generated_goal_prompt
created_at: 2026-06-14
---

# Generated Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/building/TKT-027-eval-os-mini-app/ticket.md
- tickets/building/TKT-027-eval-os-mini-app/program.md
- tickets/building/TKT-027-eval-os-mini-app/progress.md
- ui/src/modules/evals/**
- ui/src/modules/office/components/skills-panel.tsx
- ui/vite.config.ts

Task: Implement TKT-027. Replace the current global Evals placeholder with a
Farplane-native Eval OS mini app based on the existing eval viewer and local run
artifact contract. Preserve Skill OS skill-local eval file viewing. Do not treat
Evals as a skill list or nested Skill OS tab.

Logging: Before ending each turn, append compact progress to
tickets/building/TKT-027-eval-os-mini-app/progress.md when ticket state changes.

Metric: Satisfy the Done / Proof in ticket.md and program.md: focused checks,
structured eval endpoints, and browser screenshots proving the mini app states.

After each turn: Compare progress against ticket.md, continue within the current
execution window if useful, otherwise stop complete or report the exact blocker
and attempted proof paths.
```
