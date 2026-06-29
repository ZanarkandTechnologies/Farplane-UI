---
ticket_id: TASK-0031
status: active
created_at: 2026-06-29
updated_at: 2026-06-29
---

# Progress

## 2026-06-29

- Created Goal Packet for per-project Timeline hook configuration UI.
- Selected implementation path: evolve Hook Telemetry into Project Timeline with
  Hooks and Programs tabs, keeping config in project-local `.farplane/hooks/config.json`.
- Implemented Project Timeline tabs: Events, Hooks, Programs, Raw, and Distribution.
- Added `summaryEnabled` to project hook config and made the file-change hook
  skip legacy summary bubbles while preserving typed `farplane.*` file events.
- Added split Hooks UI with file-change listener detail, manifest pattern
  selection, active pattern count, install action, recent preview, and subscribed
  program previews.
- Added Event Programs preview tab for ticket completion review, decision miner,
  and goal health check routes without scheduling jobs.
- Verification:
  - `npm run test:once -- hooks/shared/project-hook-config.test.ts hooks/file-change-listener/handler.test.ts`
  - `npx biome check --files-ignore-unknown=true ui/src/modules/hook-telemetry/raw-telemetry-panel.tsx ui/src/modules/hook-telemetry/timeline-hook-panels.tsx hooks/shared/project-hook-config.ts hooks/file-change-listener/run.ts hooks/shared/project-hook-config.test.ts ui/vite.config.ts`
  - `npm run typecheck:root`
  - `npm run --workspace @farplane/ui typecheck -- --pretty false | rg "hook-telemetry|timeline-hook-panels|raw-telemetry"` returned no matching errors; full UI typecheck still has unrelated existing debt.
  - Playwright smoke: `/hook-telemetry` Hooks tab rendered `File Change Listener`
    and `Summary bubbles` with no page/console errors.
  - Playwright smoke: Programs tab rendered `Ticket Completion Review` and
    `Routing preview only` with no page/console errors.
- Evidence:
  - `tickets/TASK-0031/artifacts/timeline-hooks.png`
  - `tickets/TASK-0031/artifacts/timeline-programs.png`
