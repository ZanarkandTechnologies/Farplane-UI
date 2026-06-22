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
- Remaining proof gap:
  - Browser QA screenshots were not captured because no seeded/live Convex
    telemetry browser fixture was started in this pass. The QA cookbook now
    names the exact telemetry-only and connected-control browser proof path.
