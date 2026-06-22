---
ticket_id: TASK-0003
kind: goal-program
status: active
created_at: 2026-06-22
updated_at: 2026-06-22
---

# Goal Program

## Trigger
active_goal

## Budget
- time: current implementation window
- token/model/compute: native Codex local execution; no explicit token cap
- subagents: optional for browser QA or review only if the implementation grows
- spend/deploy/account changes: none

## Metric / Feedback Provider
mechanical:
- focused tests cover telemetry-to-observed-worker projection, source identity
  separation, app-server-disconnected fallback, and connected override behavior
- representative manual hook telemetry proof shows observed Codex workers can be
  derived from machine/runtime identity plus project/session/thread identity
- `bash scripts/pre_push_check.sh` runs before commit, with any known unrelated
  blockers recorded

browser / qa:
- `/office` renders telemetry-observed Codex workers without a Codex app-server
  connection
- connecting or mocking one Codex instance enables controls only for that
  matching source instance

review:
- runtime adapter boundaries remain intact
- observed telemetry rows do not leak raw prompts, transcripts, credentials, or
  local secrets into browser-visible state
- direct send/read/role controls stay lazy and disabled for observed-only workers

## Drift Policy
Inline drift check before final and before commit:
- compare changed files against `tickets/TASK-0003/ticket.md`
- verify project identity is not used alone for dedupe or control ownership
- verify unrelated messy worktree changes are not staged
- verify any manual hook proof is recorded in `progress.md`

## Stop Policy
Complete only when `TASK-0003` Done / Proof is satisfied or when the remaining
gap is explicitly documented as blocked by missing hook payload identity or
runtime APIs. Commit only scoped files for this ticket.
