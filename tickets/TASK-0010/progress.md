# TASK-0010 Progress

## 2026-06-24 Planning
- Request: make the thread lineage backfill process more minimal, then
  `impl-plan` it and create a Goal to run it end to end.
- Context read:
  - `impl-plan` skill, ticket template, review checklist, QA checklist
  - `goal-advisor` skill and native Goal prompt template
  - `cli/AGENTS.md`
  - `cli/farplane-cli.ts`, `cli/cli-utils.ts`, CLI test patterns
  - `ui/src/modules/runtime/lib/codex-app-server/client.ts`
  - `ui/src/modules/runtime/lib/codex-app-server/types.ts`
  - `convex/modules/hookTelemetry/events.ts`
  - `convex/modules/hookTelemetry/projections.ts`
  - `hooks/thread-lineage-listener/handler.ts`
  - `tickets/TASK-0008/ticket.md`
- Decision: implement a CLI-owned explicit-only backfill. No automation
  catalogue, no title inference, no transcript/session-file scraping, no new
  Convex table, and no UI redesign.
- Dedupe basis: `hookTelemetryEvents` already dedupes by `eventKey`; the CLI
  will emit stable logical event keys for `{projectId,parentThreadId,childThreadId,kind}`.
- Plan written:
  - `tickets/TASK-0010/ticket.md`
  - `tickets/TASK-0010/program.md`
  - `tickets/TASK-0010/progress.md`
- Verification: planning only; implementation checks not run yet.
- Next action: create native Goal and implement the packet.

## 2026-06-24 Implementation
- Implemented:
  - Added `cli/thread-commands.ts` with `threads backfill`.
  - Registered the command in `cli/farplane-cli.ts`.
  - Added `cli/thread-commands.test.ts`.
  - Added a hook telemetry projection regression proving
    `thread-lineage-backfill` rows render in the existing Threads graph.
- Behavior:
  - `threads backfill --dry-run --json` lists Codex app-server threads through
    the state bridge, filters to the repo project path, and emits rows only
    when `parentThreadId` is explicit.
  - Non-dry-run posts rows to `/telemetry/hooks/batch`.
  - Stable event key format:
    `thread-lineage:v1:{projectId}:{parentThreadId}:{childThreadId}:forked`.
  - Default project path resolves to the repo root, not the `cli/` workspace
    directory used by npm workspace execution.
- Verification:
  - `npm run test:once -- cli/thread-commands.test.ts convex/modules/hookTelemetry/hookTelemetry.test.ts`
    passed: 2 files, 13 tests.
  - `npm run typecheck:root -- --pretty false` passed.
  - `npm run cli -- threads backfill --dry-run --json --limit 50 --state-base http://127.0.0.1:5199`
    passed against the local state bridge: scanned 50 threads, emitted 0 rows,
    published 0 rows.
- Evidence note:
  - The live dry-run emitted 0 rows because recent Farplane-UI thread metadata
    from the app-server sample did not expose explicit `parentThreadId`. This
    is acceptable for the minimal explicit-only slice; fixture tests prove the
    emitted row shape and publish path when metadata exists.
- Next action:
  - Review diff; later project-scoped Threads UI can consume the same graph
    without another storage change.
