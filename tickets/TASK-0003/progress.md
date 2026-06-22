---
ticket_id: TASK-0003
kind: goal-progress
status: active
created_at: 2026-06-22
updated_at: 2026-06-22
---

# Progress

## 2026-06-22

- Created Goal Packet for telemetry-first Codex office presence.
- Goal shape: `active_goal`.
- Source files: `ticket.md`, `program.md`, `progress.md`, plus the implementation
  files named by the ticket `Map` and `Touch` sections.
- Initial scope guard: messy worktree is allowed, but commit/stage must include
  only `TASK-0003` ticket/proof/code changes.
- Implemented telemetry-first observed Codex presence projection and UI merge:
  - Convex hook telemetry now projects compact `ObservedCodexWorker` rows with
    machine/runtime, project, and session/thread identity.
  - Office provider merges observed workers into the Codex office model as
    read-only `codex-observed:*` employees.
  - Codex app-server control paths reject observed-only workers as read-only.
- Focused verification:
  - `npm run test:once -- convex/modules/hookTelemetry/hookTelemetry.test.ts ui/src/providers/office-data-provider.test.ts`
    passed: 2 files, 30 tests.
  - `npm run typecheck:root` passed.
  - `npx tsc -p convex/tsconfig.json --noEmit` passed.
- Manual hook proof:
  - observed telemetry projection separated `machine-a` and `machine-b` workers
    in the same project and did not leak prompt text.
  - skill invocation hook parser detected `goal-advisor` and did not leak
    transcript-like output.
  - file-change hook parser produced one compact message for
    `tickets/TASK-0003/progress.md`.
- Broad verification:
  - `npm run ui:build` passed.
  - `bash scripts/pre_push_check.sh` exited 0.
  - Required pre-push gates passed: code-smell check, root build/typecheck, UI
    production build.
  - Advisory pre-push gates passed: lint, tests, Codex agent review.
  - Advisory full typecheck remains warn-only due existing UI type debt outside
    this ticket; representative errors include JSX namespace issues, AI Elements
    exports, office layout typing, OpenClaw adapter ledger typing, and
    skill-studio runtime export debt.
- Proof gap at commit `e2e9458`:
  - Browser QA screenshots were not captured because no seeded/live Convex
    telemetry browser fixture was started in this pass. The QA cookbook now
    names the exact telemetry-only and connected-control browser proof path.

## 2026-06-22 Browser Evidence

- Ran `npx convex dev --once`.
- Seeded two recent hook telemetry rows through `/telemetry/hooks/batch`:
  - `task-0003-machine-a` / `task-0003-thread-a`
  - `task-0003-machine-b` / `task-0003-thread-b`
- Started the UI with `VITE_CONVEX_URL` derived from local `.env.local` and
  without setting `VITE_CODEX_APP_SERVER_URL`.
- Opened `http://127.0.0.1:5173/office` with `agent-browser`.
- Captured:
  - `docs/research/qa-testing/TASK-0003/2026-06-22_telemetry_presence/office-telemetry-observed.png`
  - `docs/research/qa-testing/TASK-0003/2026-06-22_telemetry_presence/office-telemetry-observed-state.json`
  - `docs/research/qa-testing/TASK-0003/2026-06-22_telemetry_presence/report.md`
- Browser state showed `observedCount: 2`; both observed employees were in the
  same project team, separated by machine id, and had `controllable:false`.
- The previously noted telemetry-only browser proof gap is now closed.
- Remaining optional visual proof: connect a real/mock Codex app-server instance
  and capture controls enabling only for that source instance.
