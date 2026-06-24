# TASK-0010 Program

## Goal
Implement the minimal thread lineage backfill CLI that reconciles explicit
Codex `parentThreadId` metadata into existing hook telemetry rows.

## Loop Shape
- `type:` active_goal
- `owner:` Codex implementer
- `approval:` approved by user request to plan and create a Goal to run end to end
- `state surfaces:`
  - `ticket.md` owns scope and Done / Proof
  - `program.md` owns implementation loop policy
  - `progress.md` owns compact evidence log

## Files
- `tickets/TASK-0010/ticket.md`
- `tickets/TASK-0010/program.md`
- `tickets/TASK-0010/progress.md`
- `cli/AGENTS.md`
- `cli/farplane-cli.ts`
- `cli/cli-utils.ts`
- `ui/src/modules/runtime/lib/codex-app-server/client.ts`
- `ui/src/modules/runtime/lib/codex-app-server/types.ts`
- `convex/modules/hookTelemetry/events.ts`
- `convex/modules/hookTelemetry/projections.ts`
- `hooks/thread-lineage-listener/handler.ts`

## Budget
- `time:` one focused implementation pass
- `compute:` local tests, dry-run command, root typecheck
- `spend:` none
- `deploy:` none
- `destructive actions:` none
- `subagents:` none required for this CLI-only mechanical slice

## Metric
Mechanical:
- targeted tests pass
- CLI dry-run returns deterministic JSON
- typecheck passes
- ticket/progress evidence updated

## Program
```text
ground_cli_and_types() -> current command seams
add_thread_backfill_command() -> registered `threads backfill`
build_deterministic_backfill_rows() -> stable hook telemetry envelopes
publish_or_dry_run_rows() -> batch ingest or JSON preview
verify_dedupe_projection() -> focused tests
run_evidence_commands() -> checks + progress writeback
```

## Drift Policy
- Do not add automation catalogue.
- Do not scan transcripts or raw session files.
- Do not infer lineage from titles, previews, timestamps, or prompt text.
- Do not add a Convex table or schema migration.
- Do not redesign the UI graph.
- Treat missing `parentThreadId` as no candidate, not as a blocker.

## Proof Route
- `checks:`
  - `npm run test:once -- cli/thread-commands.test.ts convex/modules/hookTelemetry/hookTelemetry.test.ts`
  - `npm run cli -- threads backfill --dry-run --json`
  - `npm run typecheck:root -- --pretty false`
- `manual:`
  - dry-run JSON includes only sanitized lineage rows and stable event keys
- `review:`
  - self-review against minimality/no-scraping/no-new-table constraints
- `final evidence:`
  - concise command summaries and changed files in final response

## Stop Conditions
- `complete:` Done / Proof passes and progress/ticket evidence is updated.
- `blocked:` Codex app-server thread list is unavailable and no safe fixture or
  test seam can prove the command.
- `revise:` implementation requires inference, raw transcript scanning,
  automation catalogue, or a new durable table.
