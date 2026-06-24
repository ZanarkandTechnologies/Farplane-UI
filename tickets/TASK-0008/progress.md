# TASK-0008 Progress

## 2026-06-24 Planning
- Request: assess feasibility and create an `impl-plan` for tracking Codex
  thread forking/creation through hooks and showing a UI graph.
- Context read:
  - `AGENTS.md`, `PROJECT_RULES.md`, `ARCHITECTURE.md`
  - active tickets, especially `TASK-0002`
  - `docs/MEMORY.md`, `docs/TROUBLES.md`, `docs/LESSONS.md`
  - `scripts/install-farplane-hooks.mjs`
  - `hooks/skill-invocation-listener/`, `hooks/file-change-listener/`,
    `hooks/shared/telemetry-outbox.ts`
  - `convex/modules/hookTelemetry/`
  - `ui/src/modules/hook-telemetry/`
  - graph UI patterns under `ui/src/modules/graph-workbench/` and existing UI dependencies
- Finding: feasible as a post-tool-call hook. The current raw table
  `hookTelemetryEvents` and outbox publisher already fit this event class.
- Finding: `hookTelemetryRowsToAgentBubbleMessages` already recognizes
  `thread.created` and `thread.forked`, but the managed installer does not yet
  install a listener that emits those events.
- Plan written:
  - `tickets/TASK-0008/ticket.md`
  - `tickets/TASK-0008/program.md`
  - `tickets/TASK-0008/progress.md`
- Verification: plan-only pass; no implementation tests run.
- Next action: human reviews and approves/revises the ticket plus Goal Packet
  preview before implementation.

## 2026-06-24 Implementation
- Approval: user asked to create a native Goal and implement the thread lineage
  hook/UI extension.
- Grounding:
  - Existing hook handlers accept multiple Codex hook payload spellings such as
    `hook_event_name`, `event`, `hookEventName`, `toolName`, `tool_name`,
    `tool.name`, `session_id`, `sessionId`, `turn_id`, and `turnId`.
  - Local hook debug samples confirmed current Codex hook payloads include
    `hook_event_name` and `turn_id`; live app thread tool events require the
    newly installed repo hooks to be trusted through `/hooks` before this
    session emits them.
  - Existing automation preview detection lives in
    `ui/src/modules/runtime/lib/codex-app-server/normalizers.ts`; best catalogue
    path is to enrich thread graph nodes from app-server thread preview metadata
    rather than storing automations as a separate hook-only graph.
- Implemented:
  - Added `hooks/thread-lineage-listener/` with a `PostToolUse` parser,
    sanitized envelope builder, run entrypoint, and tests.
  - Extended `scripts/install-farplane-hooks.mjs` so `npm run hooks:install`
    installs `thread-lineage-listener` beside skill and file hooks.
  - Documented allowed repo-managed hooks in
    `convex/modules/hookTelemetry/README.md` and
    `ui/src/modules/hook-telemetry/README.md`.
  - Added `getThreadLineageGraph` Convex query plus projection helpers for
    `thread.created` and `thread.forked` rows.
  - Added Raw Telemetry `Threads` tab with lineage graph, counters, and edge
    table.
  - Added `/hook-telemetry` route for direct operator and QA access to the raw
    telemetry surface.
- Native Codex app probe:
  - Created thread id: `019ef9bd-7283-77f3-90d7-e92c67ab24a9`.
  - Forked thread id: `019ef9bd-9089-7f70-892d-21b3eb0f77d6`.
  - Source thread id observed from fork result:
    `019ef8fd-c493-7de2-b860-e91185ec81f1`.
- Ingest proof:
  - Seeded two sanitized proof rows into Convex HTTP hook ingest:
    `thread.created` and `thread.forked`.
  - Response: `ok=true`, `count=2`, `duplicateCount=0`, ids
    `kn70tw340qq9e91xx2gzxmx539899d2k` and
    `kn78t2hp2bmrw3qa98cnk62wd5898dhm`.
- Verification:
  - `npm run test:once -- hooks/thread-lineage-listener hooks/shared scripts/install-farplane-hooks.test.ts convex/modules/hookTelemetry`
    passed: 6 files, 20 tests.
  - `node scripts/install-farplane-hooks.mjs --json` passed and showed 3
    managed hooks.
  - `npm run typecheck:root -- --pretty false` passed.
  - `npm run hooks:install` passed and wrote repo-local hook config; Codex still
    needs `/hooks` trust for live current-session emission.
  - `npm run ui:build` passed with existing large chunk warnings.
  - Browser QA against `http://127.0.0.1:5208/hook-telemetry` passed: Threads
    tab rendered 3 nodes, 2 edges, 1 created edge, 1 forked edge, and no console
    or page errors.
  - Screenshot: `/tmp/farplane-thread-lineage-threads-tab.png`.
- Follow-up candidate:
  - Add node metadata enrichment for automation-owned threads using the existing
    codex app-server preview parser, so graph nodes can distinguish manual
    threads, automation heartbeat threads, and spawned implementation threads.
