---
ticket_id: TASK-0004
program_version: 1
mode: active_goal
metric_provider: hybrid
drift_policy: inline
budget: one focused implementation window
created_at: 2026-06-22
updated_at: 2026-06-22
---

# TASK-0004 Program

## Goal Shape
`active_goal`: implement and verify in one uninterrupted window.

## Files
- `tickets/TASK-0004/ticket.md`
- `tickets/TASK-0004/program.md`
- `tickets/TASK-0004/progress.md`
- `hooks/file-change-listener/handler.ts`
- `hooks/file-change-listener/run.ts`
- `hooks/file-change-listener/handler.test.ts`
- `hooks/shared/telemetry-outbox.ts`
- `hooks/shared/project-hook-config.ts`
- `scripts/install-farplane-hooks.mjs`
- `ui/src/modules/hook-telemetry/raw-telemetry-panel.tsx`

## Execution Rules
- Keep summarization local to the hook runtime through the Codex CLI.
- Probe the installed Codex CLI before locking the command shape.
- Publish only `file.change.summary` by default for tracked file edits.
- Do not publish a raw `file.changed` event before or after summarization.
- Preserve outbox retry behavior for failed telemetry sends.
- Keep generated summaries short enough for employee bubbles.
- Keep hook input bounded and sanitized.
- Leave unrelated dirty worktree changes untouched.

## Metric / Feedback Provider
- Mechanical: focused tests, lint, typecheck scan, installer/hook probe, pre-push check.
- Manual: controlled tracked-file edit produces a summary event/status update.
- Review: self-review plus precommit/prepush smell checks.

## Drift Policy
Before each stop, compare actual work against `ticket.md` Done / Proof. Continue if the remaining work is inside scope. Mark blocked only for a real external dependency such as missing local Codex CLI or unavailable telemetry endpoint after reasonable fallback proof.

## Stop Policy
Stop complete only when the hook summarizes locally, publishes summary-only telemetry, proof is logged, checks are run, and the change is committed.
