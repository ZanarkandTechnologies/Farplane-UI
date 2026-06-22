---
ticket_id: TASK-0003
kind: generated-goal-prompt
status: active
created_at: 2026-06-22
updated_at: 2026-06-22
---

# Generated Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/TASK-0003/ticket.md
- tickets/TASK-0003/program.md
- tickets/TASK-0003/progress.md
- qa/cookbook/office.md
- PROJECT_RULES.md
- AGENTS.md
- convex/modules/hookTelemetry/
- convex/modules/runtimeTelemetry/
- convex/modules/agentActivity/
- ui/src/modules/runtime/
- ui/src/providers/
- ui/src/hooks/
- ui/src/modules/office/
- ui/src/modules/chat/
- ui/src/modules/settings/

Task: Complete TASK-0003 end to end. Implement telemetry-first Codex office
presence with machine/runtime-instance identity separation, lazy app-server
control, focused tests, representative manual hook proof, pre-push checks,
tidy scoped changes, and commit the finished work. Preserve the ticket's Scope,
Program, Done / Proof, privacy constraints, and adapter boundaries.

Logging: Before ending each turn, append a compact structured entry to
tickets/TASK-0003/progress.md when ticket state changes, proof is gathered,
checks run, blockers appear, or commit state changes.

Metric: Satisfy the Done / Proof and Metric / Feedback Provider declared in
tickets/TASK-0003/ticket.md and tickets/TASK-0003/program.md. Do not use
project identity alone for worker dedupe or control ownership. Do not expose raw
prompts, transcripts, credentials, or secrets through observed telemetry rows.

After each turn: Compare progress against the listed files, verify drift
policy, continue if useful within the current work window, otherwise stop
complete or blocked with attempted paths and one missing input. Before commit,
run focused tests, representative manual hook checks, and
bash scripts/pre_push_check.sh; stage only scoped TASK-0003 changes.
```
