---
ticket: TKT-025
created: 2026-06-14
source: goal-advisor
---

# Generated Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/building/TKT-025-skill-invocation-listener-hook/ticket.md
- tickets/building/TKT-025-skill-invocation-listener-hook/program.md
- tickets/building/TKT-025-skill-invocation-listener-hook/progress.md
- tickets/building/TKT-025-skill-invocation-listener-hook/generated-goal-prompt.md

Task: Implement TKT-025 end to end: Codex PostToolUse skill-read hook, install helper, Convex ingestion/query module, UI dashboard module, verification, and installation/trust guidance. Treat the listed ticket as the source of truth.

Logging: Before ending each turn, append a compact progress entry to progress.md with changed files, verification run, evidence captured, blockers, and next action.

Metric: Satisfy the ticket Done / Proof. Mechanical checks are hook classifier tests, Convex/backend checks, UI tests or build, install-helper dry run, and browser QA evidence where available.

After each turn: Compare progress against ticket Acceptance Criteria and Done / Proof. Continue while useful within the current turn. Stop complete only when proof is reconciled; stop blocked only after the same blocker repeats for three consecutive Goal turns.
```
