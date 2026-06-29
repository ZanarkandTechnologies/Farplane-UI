---
ticket_id: TASK-0031
program_id: goal-task-0031-timeline-hooks-ui
status: active
created_at: 2026-06-29
updated_at: 2026-06-29
---

# Goal Program: TASK-0031 Timeline Hook Configuration UI

## Files

- `tickets/TASK-0031/ticket.md`
- `tickets/TASK-0031/program.md`
- `tickets/TASK-0031/progress.md`
- `ui/src/modules/hook-telemetry/raw-telemetry-panel.tsx`
- `ui/src/modules/hook-telemetry/timeline-hook-panels.tsx`
- `ui/src/modules/hook-telemetry/README.md`
- `ui/src/modules/hook-telemetry/docs/feature-registry.md`
- `ui/src/modules/hook-telemetry/docs/qa-runbook.md`
- `hooks/shared/project-hook-config.ts`
- `hooks/file-change-listener/run.ts`
- `ui/vite.config.ts`

## Loop Shape

`active_goal`: one focused implementation and proof window.

## Metric

Hybrid:
- mechanical: focused hook tests and `npm run typecheck:root`
- visual: screenshot or browser smoke evidence of Timeline/Hooks UI
- review: inline ownership/maintainability check before commit

## Budget

- Time: one focused local pass
- Model/compute: local shared
- Subagents: none required unless visual/browser proof becomes flaky
- Spend: none

## Drift Policy

Before completion, compare the diff against the ticket:
- no browser localStorage for durable hook config
- no hidden daemon/job runner
- Hook config capture and Event Programs routing remain separate
- typed file events still publish when summary is disabled

## Completion Checkpoint

Update `progress.md` and `ticket.md` with:
- changed files
- tests/checks run
- screenshot or explicit blocker
- residual risk
