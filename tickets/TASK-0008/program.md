# TASK-0008 Program

## Goal
Make Codex thread branching observable in Farplane by capturing native
create/fork tool calls through hook telemetry and rendering a read-only lineage
graph in Raw Telemetry.

## Loop Shape
- `type:` active_goal after human approval
- `owner:` Codex implementer
- `approval:` approved by user request to create a native goal and implement
- `state surfaces:`
  - `ticket.md` owns scope and proof
  - `program.md` owns loop policy
  - `progress.md` owns append-only evidence

## Files
- `tickets/TASK-0008/ticket.md`
- `tickets/TASK-0008/program.md`
- `tickets/TASK-0008/progress.md`
- `hooks/skill-invocation-listener/handler.ts`
- `hooks/file-change-listener/handler.ts`
- `hooks/shared/telemetry-outbox.ts`
- `scripts/install-farplane-hooks.mjs`
- `convex/modules/hookTelemetry/projections.ts`
- `convex/modules/hookTelemetry/queries.ts`
- `convex/modules/hookTelemetry/validators.ts`
- `ui/src/modules/hook-telemetry/raw-telemetry-panel.tsx`
- `ui/src/modules/graph-workbench/`

## Budget
- `time:` one focused implementation pass
- `compute:` local tests, typecheck/build, browser QA
- `spend:` none
- `deploy:` none
- `destructive actions:` none
- `subagents:` optional reviewer/QA lane after implementation

## Metric
Hybrid:
- mechanical tests pass for parser, installer, Convex projection, and UI helper
- installer JSON proves the managed hook set
- browser proof shows Raw Telemetry thread graph with created and forked edges
- review confirms privacy, module boundaries, and no raw transcript persistence

## Program
```text
ground_payloads() -> representative create_thread/fork_thread fixtures
add_listener(fixtures) -> parser + telemetry envelope + run entrypoint
install_listener() -> managed hooks config includes third PostToolUse listener
project_graph(rows) -> ThreadLineageGraph nodes/edges/stats
render_graph(graph) -> Raw Telemetry Threads tab
verify_all() -> tests + installer dry run + browser screenshot + review
closeout() -> ticket/progress writeback and follow-up notes
```

## Drift Policy
- Stay inside existing `hookTelemetryEvents` unless bounded-window graph queries
  are proven insufficient.
- Do not scrape private `~/.codex` storage as the primary source of truth.
- Do not persist raw prompts, transcripts, or full tool output.
- Do not add graph UI mutations for creating, forking, renaming, pinning, or
  archiving threads.
- Block and report if Codex hook payloads cannot expose any stable child id,
  pending worktree id, or equivalent event key.

## Proof Route
- `checks:`
  - `npm run test:once -- hooks/thread-lineage-listener hooks/shared scripts/install-farplane-hooks.test.ts convex/modules/hookTelemetry`
  - `node scripts/install-farplane-hooks.mjs --json`
  - `npm run ui:build` or documented narrower fallback for unrelated debt
- `manual:`
  - seed or capture created and forked thread lineage events
  - open Raw Telemetry -> Threads
  - capture desktop screenshot and console/page errors
- `review:`
  - advisory reviewer for privacy and module boundaries
- `final evidence:`
  - final response includes best screenshot as Markdown image evidence or blocks
    with missing proof reason

## Stop Conditions
- `complete:` all Done / Proof conditions pass and progress/ticket evidence is updated.
- `blocked:` stable thread child identity cannot be observed without private
  file scraping or a new trusted API that is outside this ticket.
- `revise:` implementation needs new durable storage, new control-plane
  mutations, or broader UX than Raw Telemetry.
