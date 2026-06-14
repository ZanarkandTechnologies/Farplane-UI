# TKT-005 Goal Program

## Loop Shape

- trigger_mode: `active_goal`
- loop_owner: native Codex Goal mode
- next_owner: implementation lane in this thread unless redirected
- stop_condition: all acceptance criteria are implemented, tests pass or blockers are recorded, and the ticket/progress files reflect final state

## Metric / Feedback Provider

- provider: `hybrid`
- mechanical evidence:
  - Codex runtime adapter tests prove `thread.status` maps to `AgentLiveStatus`
  - office mapper/provider tests prove employee heads receive loader/status fields
  - narrow typecheck/test command output is recorded in the ticket
- review evidence:
  - self-review against runtime module boundary and ticket acceptance criteria
  - reviewer lane if changes expand into gateway streaming infrastructure

## Drift Policy

- drift_check: inline each turn
- compare:
  - `ticket.md` acceptance criteria
  - this `program.md` loop shape and stop condition
  - recent `progress.md` entries
- use external drift reviewer only if implementation expands from status normalization into broader gateway, WebSocket, or chat-panel architecture.

## After Each Turn

1. Append a compact entry to `progress.md` with trigger, work done, files touched, evidence, drift verdict, blockers, and next action.
2. Keep the implementation scoped to runtime status normalization first.
3. Prefer polling `thread/list` for office-wide employee heads and reserve `thread/resume` streaming for selected chat/session panels.
4. Stop complete only when tests/evidence satisfy the ticket, or report blocked with attempted paths and the one missing input.

## Native Goal Prompt

```text
/goal Run tickets/review/TKT-005-codex-thread-live-status-goal/ticket.md as a Goal Packet.
Task: Implement Codex thread live status for Farplane UI employee loaders. Poll `thread/list` for cheap roster/head status, map Codex `thread.status` into stable `AgentLiveStatus`, preserve employee head rendering through the existing office data mapper/provider path, and document or scaffold the selected-thread `thread/resume` streaming route without coupling the Three.js employee components directly to Codex app-server schemas.
Logging: Before ending each turn, append a compact structured entry to tickets/review/TKT-005-codex-thread-live-status-goal/progress.md with trigger, intent, actions, files/artifacts, metric sample, drift verdict, next_action, and blockers.
Metric: Satisfy the hybrid metric in tickets/review/TKT-005-codex-thread-live-status-goal/program.md: focused runtime adapter tests for active/idle/error/not-loaded thread states, office mapper/provider propagation tests for employee status fields, and narrow typecheck/test evidence where feasible.
After each turn: compare progress against ticket.md and program.md, keep the implementation scoped to the largest unresolved acceptance/evidence gap, request reviewer help only if the change expands into gateway streaming infrastructure, then continue, stop complete, or report blocked with attempted paths and one missing input.
```
