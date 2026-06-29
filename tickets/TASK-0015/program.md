---
ticket_id: TASK-0015
kind: goal-program
status: done
created_at: 2026-06-25
updated_at: 2026-06-25
---

# TASK-0015 Program

```text
mode: active_goal
metric_provider: mechanical_checks + route_payload_evidence + browser_visible_evidence_if_available
budget:
  time: current implementation turn
  spend: none
  subagents: none unless verification needs independent review
drift_policy:
  compare implementation against ticket.md before final response
proof_route:
  focused type/build checks, git diff check, scan endpoint proof, browser proof
  when local runtime permits
stop_policy:
  complete when Done / Proof is satisfied or block with exact missing proof
```

## Ordered Operations

1. Read the Farplane template registry payload and current Template Tracking
   scan/panel code.
2. Add registry row parsing to the Vite harness bridge.
3. Decorate registry rows with maintainability policy fields.
4. Preserve UI-local family rows as fallback when the registry is unavailable.
5. Render policy fields in Template Tracking rows without bloating the charts.
6. Update Harness OS docs with the template ownership/install rule.
7. Verify with focused mechanical checks and endpoint/browser evidence.
8. Update progress and ticket state.

## Native Goal Prompt

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
