---
ticket: TKT-025
goal: Skill invocation listener hook and dashboard
status: active
created: 2026-06-14
---

# Program

## Goal Shape

- trigger: active_goal
- owner: native Codex Goal in this thread
- files:
  - `tickets/building/TKT-025-skill-invocation-listener-hook/ticket.md`
  - `tickets/building/TKT-025-skill-invocation-listener-hook/program.md`
  - `tickets/building/TKT-025-skill-invocation-listener-hook/progress.md`
  - `tickets/building/TKT-025-skill-invocation-listener-hook/generated-goal-prompt.md`
- budget: not specified
- metric provider: mechanical checks plus browser QA evidence
- drift policy: inline drift check against ticket Done / Proof before each final/stop decision
- logging: append compact progress entries to `progress.md`

## Execution Program

```text
ground:
  read ticket, project rules, nearest module contracts, current Codex hook docs

implement:
  hook_package -> classifier + publisher + tests
  convex_backend -> schema + HTTP ingest + dashboard query + tests/codegen
  ui_module -> panel + launcher registry + tests
  install_helper -> idempotent hooks.json generation + status/trust guidance

verify:
  focused hook tests
  focused Convex/backend tests or typecheck
  focused UI tests/build
  install helper dry run / actual local install when safe
  browser QA screenshot when dev server can run

stop:
  complete only when ticket ACs are reconciled and install guidance is reported
  blocked only after the same blocker repeats for three consecutive Goal turns
```

## Stop Conditions

- complete: TKT-025 Done / Proof is satisfied or honestly narrowed with user-approved remaining work.
- blocked: same external blocker repeats for three consecutive Goal turns and no meaningful local work remains.
- hold: hook trust must be completed manually through Codex `/hooks`; do not mark this as implementation failure.
