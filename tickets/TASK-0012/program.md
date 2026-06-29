---
ticket_id: TASK-0012
kind: goal-program
status: done
created_at: 2026-06-25
updated_at: 2026-06-25
---

# TASK-0012 Program

```text
mode: active_goal
metric_provider: mechanical_checks + browser_visible_evidence
budget:
  time: current implementation turn
  spend: none
  subagents: none unless verification needs independent review
drift_policy:
  compare implementation against ticket.md before final response
proof_route:
  type/build checks, git diff check, browser screenshot when local app can run
stop_policy:
  complete when Done / Proof is satisfied or block with exact missing proof
```

## Ordered Operations

1. Read current Harness OS panels, payload types, chart primitives, and module
   docs.
2. Create chart transform helpers inside the owning panel files unless reuse
   forces extraction.
3. Update Rollout with project latest/spec adoption scorecards and debt rows.
4. Update Template Tracking with scorecards, stacked distribution bars, debt
   leaderboard, skill priority quadrant, and worklists.
5. Keep archived ticket template behavior framed as active/new-ticket
   compliance only.
6. Verify with mechanical checks and browser evidence if possible.
7. Update progress and ticket state.

## Native Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/TASK-0012/ticket.md
- tickets/TASK-0012/program.md
- tickets/TASK-0012/progress.md
- ui/src/modules/harness-os/harness-rollout-panel.tsx
- ui/src/modules/harness-os/template-tracking-panel.tsx
- ui/src/modules/harness-os/harness-os-types.ts

Task: Complete the dashboard charts and worklists defined in TASK-0012. Use
the existing read-only adoption, template tracking, and skill rollout payloads.
Do not add backend scan commands or disturb unrelated dirty worktree changes.

Logging: Before ending each turn, append a compact entry to progress.md with
changed files, verification, blockers, and next action.

Metric: Satisfy ticket Done / Proof. For UI proof, include browser-visible
evidence when local runtime permits; otherwise record the blocker.

After each turn: Compare current changes against ticket.md, continue if useful,
or stop complete/blocked with the exact verification state.

Approval: approved by the operator's explicit request to create the ticket and
implement with a Goal.
```
