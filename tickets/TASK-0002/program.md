---
ticket_id: TASK-0002
kind: goal-program
status: active
created_at: 2026-06-21
updated_at: 2026-06-21
---

# Goal Program

## Trigger
active_goal

## Budget
- time: current implementation window
- token/model/compute: not specified
- subagents: none unless QA/review becomes too large
- spend/deploy/account changes: none

## Metric / Feedback Provider
mechanical:
- focused Vitest tests for hook config/outbox/listener behavior
- installer dry-run JSON proves both hooks are present
- UI type/build evidence for the hook telemetry panel path

review:
- code structure stays module-local and minimal
- no hook-path LLM calls
- no browser-side `~/.codex` scraping

## Drift Policy
Inline drift check before final:
- compare changed files against `tickets/TASK-0002/ticket.md`
- verify no unrelated legacy `TKT-*` ticket work was staged or committed
- verify installer writes repo-local `.codex/hooks.json` only when invoked

## Stop Policy
Complete only when the UI, CLI install path, config resolver, file-change hook, and outbox retry are implemented and verified. Block only on missing runtime APIs that cannot be safely added to the Vite bridge.
