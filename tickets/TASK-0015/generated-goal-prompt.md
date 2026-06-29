---
ticket_id: TASK-0015
kind: generated-goal-prompt
status: done
created_at: 2026-06-25
updated_at: 2026-06-25
---

# Generated Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/TASK-0015/ticket.md
- tickets/TASK-0015/program.md
- tickets/TASK-0015/progress.md
- ui/vite.config.ts
- ui/src/modules/harness-os/harness-os-types.ts
- ui/src/modules/harness-os/template-tracking-panel.tsx
- ui/src/modules/harness-os/README.md

Task: Implement TASK-0015. Make Template Tracking prefer the Farplane
docs/templates/registry.jsonl payload, decorate rows with install target,
history policy, consumer scope, and registry path, preserve the existing
UI-local family list as fallback only, and update Harness OS docs with the
template ownership rule. Do not move template files or disturb unrelated dirty
worktree changes.

Logging: Before ending each turn, append a compact entry to progress.md with
changed files, verification, blockers, and next action.

Metric: Satisfy ticket Done / Proof. Include scan endpoint evidence and browser
evidence when local runtime permits; otherwise record the blocker.

After each turn: Compare current changes against ticket.md, continue if useful,
or stop complete/blocked with the exact verification state.

Approval: approved by the operator's explicit request to create the ticket and
execute the Goal.
```
