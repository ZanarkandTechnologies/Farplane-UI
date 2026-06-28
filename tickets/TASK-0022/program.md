---
ticket_id: TASK-0022
kind: goal-program
status: complete
created_at: 2026-06-28
updated_at: 2026-06-28
---

# Goal Program

## Trigger

active_goal

## Budget

- time: current implementation window
- token/model/compute: native Codex local execution; no explicit token cap
- subagents: not required unless visual QA cannot be captured locally
- spend/deploy/account changes: none

## Metric / Feedback Provider

ui_snapshot_review:
- The implemented Runtime Health panel visibly matches the approved ASCII
  structure:
  - Health view: header status strip, findings column, evidence/actions column,
    breadcrumb tail.
  - Drift view: runtime reconciliation and office integrity.
  - Sessions view: recent sessions and selected session tail.
  - Debug Tail view: sanitized warnings/errors/breadcrumbs.
- The panel does not duplicate Raw Telemetry or Harness Usage as its primary
  job.

mechanical:
- `npm run ui:typecheck` passes, or unrelated existing blockers are recorded.

browser / qa:
- Start `npm run ui`.
- Open `/office`.
- Open Runtime Health from the bottom-right launcher.
- Capture the four required screenshots under
  `docs/research/qa-testing/TASK-0022/<run>/screens/`.

review:
- Compare screenshot structure against the ASCII designs before final.
- Completion must include best screenshot evidence.

## Drift Policy

Inline drift check before final:
- changed source files stay scoped to the HUD drawer/launcher, Runtime Health
  model helper/test, and ticket packet
- ticket non-goals remain true
- screenshot evidence exists or the blocker is explicit
- dirty unrelated worktree changes are not reverted or claimed

## Stop Policy

Complete only when `TASK-0022` Done / Proof is satisfied. If the app cannot boot
or screenshots cannot be captured, stop blocked with the exact failing command,
browser state, and remaining proof gap.
