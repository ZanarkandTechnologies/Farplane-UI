---
ticket_id: TASK-0019
title: Install Codex Event Miner Stop Hook
phase: planning
status: review
owner: Farplane UI
claimed_by:
priority: high
depends_on:
  - TASK-0018
blocked_by: []
ready: true
approval_required: true
requires_qa: true
requires_demo: false
created_at: 2026-06-26
updated_at: 2026-06-26
next_action: run the TASK-0019 closeout proof plan: installer dry-run, event-miner dry-run Stop payload, telemetry/projection checks, then reviewer gate
last_verification: focused tests and root typecheck passed after refactoring codex-event-miner into focused modules
---

# TASK-0019: Install Codex Event Miner Stop Hook

## Summary

Install a repo-managed `codex-event-miner` Stop hook that launches detached
Codex event-mining agents for current sessions. The hook is a dispatcher, not
the miner: it maintains cadence/window state, writes a bounded agent context,
spawns `codex exec` with program instructions, and publishes only operational
events plus fallback report events.

This is the live, rolling-window feature. It is not the historical chat-history
mining platform in TASK-0020; it only covers current Stop hook payloads, local
miner window state, and completed learning-review reports already present under
`.farplane/event-miner/runs`.

## Scope

- In:
  - Add `hooks/codex-event-miner` as a Codex `Stop` hook package.
  - Extend `scripts/install-farplane-hooks.mjs` so managed hooks can install
    both `PostToolUse` and `Stop` entries.
  - Define the miner event contract using the existing `hookTelemetryEvents`
    raw table and `/telemetry/hooks` ingest route.
  - Add producer events for:
    - `miner.agent.queued`
    - `miner.agent.launched`
    - `miner.agent.failed`
    - `miner.agent.completed`
    - `learning.lesson.observed`
    - `learning.trouble.observed`
    - `decision.observed`
  - Keep `miner.window.updated` and `miner.agent.skipped` as opt-in verbose
    debugging events, not default per-Stop telemetry.
  - Include `ticketId`, `sessionId`, `turnId`, `projectId`, `cwd`,
    `reviewRunPath`, `source`, `eventName`, `eventAt`, and a stable `eventKey`
    wherever the source can infer them safely.
  - Keep the Stop-hook fast path bounded:
    - every Stop updates local miner window state
    - every 5 turns by default launches a detached miner agent with
      `decision-v1` and `learning-docs-v1` program instructions
    - completed miner-agent reports may flush fallback
      lesson/trouble/decision observations without blocking the Stop hook
  - Extend Farplane UI hook telemetry projections to expose a learning timeline
    grouped by ticket, session, event kind, severity/status, and time.
  - Make the UI projection suitable for a future Self Improvement or Decision
    Timeline panel without creating a new raw telemetry table.
  - Add fixture payloads representing Stop payloads and completed learning
    reviewer reports with docs deltas and decisions.
- Out:
  - No full historical transcript import.
  - No separate "self event log" storage table.
  - No raw prompts, transcripts, full assistant messages, tool output, repo file
    contents, or secrets in telemetry payloads.
  - No automatic skill, lesson, trouble, memory, or ticket edits from telemetry
    projection alone.
  - No UI scoring of business outcomes beyond rendering observed learning and
    decision events.

## Delta

- `Before:` Farplane had PostToolUse hook telemetry and file-change summaries,
  but no repo-managed Stop hook that could launch a bounded event miner for
  current Codex sessions.
- `After:` `codex-event-miner` is the live rolling-window Stop hook: it keeps
  per-session window state, queues a detached miner after cadence, launches
  `codex exec --disable codex_hooks`, publishes compact lifecycle/report events
  through existing hook telemetry, and projects learning/decision rows without
  raw transcript payloads.
- `Why now:` the system needs current-session learning/decision telemetry before
  the broader Thread Data/backfill and replayable-job layers are treated as
  canonical. This ticket proves the live hook path only; TASK-0020 owns
  historical mining and stays out of scope here.
- `First-principles basis:` the Stop hook should be a dispatcher, not the
  miner. Shutdown paths must stay bounded, telemetry must stay compact, and
  detached agents own transcript inspection.

## Change Plan

### Change 1: close the Stop-hook launcher path

```text
fixes:
  - Prove the live Stop hook can parse a Stop payload, update cadence state,
    launch a detached miner, and publish compact lifecycle telemetry.
before:
  - Implementation exists, but ticket closeout still depends on installer trust
    and representative Stop-event proof.
after:
  - TASK-0019 has concrete proof for parse -> cadence -> launch/dry-run ->
    telemetry/outbox.
read:
  - path: hooks/codex-event-miner/run.ts
    reason: entrypoint for Stop payload parsing, window state, launch, publish,
      and debug logging.
  - path: hooks/codex-event-miner/handler.ts
    reason: parse/dedupe/cadence behavior and launch request generation.
  - path: hooks/codex-event-miner/launcher.ts
    reason: detached Codex exec input/prompt/report behavior.
  - path: hooks/codex-event-miner/state.ts
    reason: per-session cadence state persistence.
write:
  - path: tickets/TASK-0019/ticket.md
    change: record closeout evidence paths and reviewer result.
operation:
  - Run focused event-miner tests.
  - Run `node scripts/install-farplane-hooks.mjs --json` to prove Stop hook
    install config.
  - Run a controlled Stop payload with `FARPLANE_EVENT_MINER_DRY_RUN=1` and
    `FARPLANE_EVENT_MINER_CADENCE_TURNS=1` so it writes a run packet without
    requiring real transcript processing.
  - Inspect `.farplane/event-miner/runs/<run>/input.json`, `prompt.md`, and
    `report.json`.
signature_or_type_impact:
  - none expected; this is closeout/proof unless tests expose a real bug.
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - `npm run test:once -- hooks/codex-event-miner scripts/install-farplane-hooks.test.ts`
  - dry-run Stop payload produces `miner.agent.queued` and
    `miner.agent.launched` or queued outbox telemetry.
failure_modes:
  - Hook config not trusted in Codex app; document as manual blocker rather than
    claiming live Stop proof.
  - Missing endpoint config queues telemetry; acceptable if outbox evidence is
    present and clearly stated.
```

### Change 2: prove report flush and learning timeline projection

```text
fixes:
  - Prove detached miner reports can become compact timeline rows without raw
    prompt/transcript leakage.
before:
  - report flushing and projection tests exist, but ticket needs explicit
    closeout evidence.
after:
  - TASK-0019 links focused Convex projection proof for decision, lesson,
    trouble, and miner lifecycle rows.
read:
  - path: hooks/codex-event-miner/reports.ts
    reason: completed report scanning and fallback event candidates.
  - path: hooks/codex-event-miner/report.schema.json
    reason: compact detached miner report contract.
  - path: convex/modules/hookTelemetry/learningTimeline.ts
    reason: projection from raw hook telemetry rows to timeline rows.
  - path: convex/modules/hookTelemetry/hookTelemetry.test.ts
    reason: existing privacy/projection tests.
write:
  - path: tickets/TASK-0019/ticket.md
    change: record projection test output and any residual risk.
operation:
  - Run `npm run test:once -- convex/modules/hookTelemetry`.
  - Confirm projected rows include `ticketId`, `sessionId`, `sourceProgram`,
    `reviewRunPath`, and doc delta counts when present.
  - Confirm raw `prompt` / `transcript` test fields do not appear in projected
    rows.
signature_or_type_impact:
  - none expected.
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - projection tests pass and show no raw prompt/transcript leakage.
failure_modes:
  - Existing tests may prove fixtures but not live Convex ingest; live ingest is
    separate manual proof and should be stated honestly if unavailable.
```

### Change 3: document scope boundary against TASK-0020

```text
fixes:
  - Prevent TASK-0019 from absorbing historical mining, replayable jobs, or
    ticket-completion scoring work.
before:
  - Ticket already says it is not historical backfill, but recent architecture
    discussion could blur the boundary.
after:
  - TASK-0019 remains the live Stop-hook rolling-window hook only.
read:
  - path: tickets/TASK-0020/ticket.md
    reason: confirm historical Thread Data/backfill remains separate.
  - path: tickets/TASK-0027/ticket.md
    reason: file-event capture is a later/sibling system, not this ticket.
  - path: tickets/TASK-0028/ticket.md
    reason: replayable jobs are a later/sibling system, not this ticket.
write:
  - path: hooks/codex-event-miner/HOOK.md
    change: update only if closeout finds scope wording is stale.
  - path: tickets/TASK-0019/ticket.md
    change: keep links and non-goals explicit.
operation:
  - Keep code changes out unless proof reveals a mismatch.
  - Record that Stop miner events are provisional/current-session learning, not
    canonical ticket-completion scorecards.
signature_or_type_impact:
  - none.
routes:
  docs: update_docs
  qa: review
  review: reviewer
qa:
  - reviewer checks scope boundary and privacy language.
failure_modes:
  - If TASK-0019 is judged strategically obsolete, close it as implemented
    foundation/superseded by TASK-0027/TASK-0028 rather than expanding it.
```

## Event Contract

```text
producer:
  hookName: codex-event-miner
  hookType: Stop
  projectId: optional stable Farplane project/team id
  sessionId: Codex session id
  eventAt: ISO timestamp
  eventKey: codex-event-miner:v1:<eventName>:<projectId>:<ticketId|none>:<sessionId>:<turnId|reviewRunHash>

payload:
  schemaVersion: 1
  eventName:
    - miner.agent.queued
    - miner.agent.launched
    - miner.agent.failed
    - miner.agent.completed
    - learning.lesson.observed
    - learning.trouble.observed
    - decision.observed
    - miner.window.updated (verbose debugging only)
    - miner.agent.skipped (verbose debugging only)
  ticketId: optional TASK-* id inferred from active ticket/cwd/message window
  turnId: optional Codex turn id
  cwd: optional repo cwd
  source: stop_payload | window_cadence | miner_agent | miner_agent_report
  sourceProgram: codex-event-miner | decision-v1 | learning-docs-v1
  status: updated | not_due | queued | launched | completed | failed | observed
  severity: optional low | medium | high
  summary: compact sanitized human-readable summary
  reviewRunPath: optional local relative path, never report content
  docsDelta: optional counts/targets only, no raw docs body
  decisionKind: optional architecture | scope | implementation | product | workflow
```

## Implementation Notes

- The default cadence is 5 turns for the miner agent.
- The hook launches `codex exec --ephemeral --disable codex_hooks` with a JSON
  context packet and prompt that tells the agent to read the session/transcript,
  run configured programs, publish to Farplane UI telemetry, and write a final
  report.
- The hook itself must not parse decisions out of `last_assistant_message`.
- Treat "backfill" in this ticket as the rolling Stop-hook window: the current
  Stop hook reviews the latest captured window, not the entire historical
  transcript archive.
- Prefer publishing through the existing hook telemetry outbox semantics so
  network failure queues the event rather than blocking Codex shutdown.
- The hook should publish through the shared telemetry outbox, so missing
  network/config queues events instead of blocking Codex shutdown.

## Done

```text
done_when:
  - `codex-event-miner` Stop hook parses representative Stop payloads into window, cadence, decision, and review-report events
  - `npm run hooks:install` installs the Stop hook idempotently beside existing PostToolUse hooks
  - representative lifecycle, lesson, trouble, and decision events ingest through existing hook telemetry
  - projection reducer/query returns a per-ticket/per-session learning timeline sorted by event time
  - UI query/view model exposes learning timeline rows without showing raw prompts, transcripts, or assistant messages
  - ticket and hook docs clearly state live miner scope versus TASK-0020 historical mining scope

proof:
  checks:
    - npm run test:once -- convex/modules/hookTelemetry
    - npm run test:once -- hooks/codex-event-miner scripts/install-farplane-hooks.test.ts
    - npx tsc -p convex/tsconfig.json --noEmit
  manual:
    - inspect fixture learning telemetry rows in the hook telemetry explorer
    - verify lesson/trouble/decision timeline rows include ticketId and sessionId when available
    - verify payload previews redact or omit raw prompts, transcripts, assistant messages, and tool outputs
  review:
    - rubric: telemetry privacy, Stop-hook latency, event dedupe, projection correctness, Core/UI ownership boundary
      required_tas: TAS-B
  evidence:
    - event contract docs or README section
    - projection fixture/test output
    - installer proof
    - hook docs
```

## QA Strategy

```text
qa_strategy:
  proof_weight: review
  checks:
    - npm run test:once -- hooks/codex-event-miner scripts/install-farplane-hooks.test.ts
    - npm run test:once -- convex/modules/hookTelemetry
    - npm run typecheck:root
  manual:
    - node scripts/install-farplane-hooks.mjs --json
    - FARPLANE_EVENT_MINER_DRY_RUN=1 FARPLANE_EVENT_MINER_CADENCE_TURNS=1 hooks/codex-event-miner/run.ts < representative Stop payload
    - inspect generated `.farplane/event-miner/runs/<run>/input.json`, `prompt.md`, and `report.json`
    - inspect hook telemetry outbox or local endpoint evidence for miner lifecycle events
  delegated_lanes:
    - reviewer lane for telemetry privacy, Stop-hook latency, event dedupe, and scope boundary
  review:
    - rubric: telemetry privacy, Stop-hook latency, event dedupe, projection correctness, Core/UI ownership boundary, TASK-0020 separation
      required_tas: TAS-B
  evidence:
    - focused test output
    - installer JSON proof
    - dry-run run path
    - sample compact telemetry payload or outbox row
    - projection test output
  goal_advisor_inputs:
    proof_route: focused hook tests + projection tests + dry-run Stop payload + reviewer gate
    final_evidence: installer proof, dry-run run path, telemetry/outbox sample, and reviewer receipt
    final_checkpoint: reviewer verifies no raw prompts/transcripts/full assistant messages/tool output are published
  residual_risk:
    - live Codex `/hooks` trust and real Stop execution may require operator action in the Codex app
    - endpoint config may queue telemetry locally instead of proving live Convex ingest
```

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - hooks/codex-event-miner/HOOK.md
    - docs/HISTORY.md
  no_docs_reason:
  validation:
    - hook docs describe config, dry-run mode, privacy rules, and live-vs-historical scope
    - history records material closeout only after proof succeeds
```

## State

- `next_action:` trust the updated repo hooks with Codex `/hooks`, then
  exercise one real Stop event against the local telemetry endpoint
- `blocked:` false
- `latest_verification:` `npm run test:once -- hooks/codex-event-miner
  scripts/install-farplane-hooks.test.ts`, `npm run test:once --
  convex/modules/hookTelemetry`, and `npm run typecheck:root` passed after
  refactoring the miner handler from one 760-line file into focused modules
- `result:` critical path implemented and locally verified

## Links

- `program:` none
- `progress:` none
- `artifacts:` none
- `review:` none
- `refs:`
  - `tickets/TASK-0018/ticket.md`
  - `convex/modules/hookTelemetry/README.md`
  - `convex/modules/hookTelemetry/schema.ts`
  - `convex/modules/hookTelemetry/events.ts`
  - `convex/modules/hookTelemetry/projections.ts`
  - `convex/modules/hookTelemetry/queries.ts`
  - `hooks/shared/telemetry-outbox.ts`
  - `hooks/codex-event-miner/HOOK.md`
  - `hooks/codex-event-miner/handler.ts`
  - `hooks/codex-event-miner/decisions.ts`
  - `hooks/codex-event-miner/reports.ts`
  - `hooks/codex-event-miner/state.ts`
  - `hooks/codex-event-miner/telemetry.ts`
  - `hooks/codex-event-miner/types.ts`
  - `convex/modules/hookTelemetry/learningTimeline.ts`
  - `scripts/install-farplane-hooks.mjs`
  - `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane/bin/runtime/stop_hook.py`
  - `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane/bin/runtime/user_turn.py`
  - `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane/agents/skill-opportunity-applier.toml`

## Notes

- `plan_qa:`
  - `minimal_required_version:` pass; closeout is proof and small doc updates,
    not new architecture.
  - `reuse_before_new_surface:` pass; uses existing hook, outbox, launcher, and
    projection surfaces.
  - `least_parameters:` pass; no new config keys planned.
  - `new_files_functions_justified:` pass; no new code files planned unless
    proof reveals a bug.
  - `minimal_impl_plan_claim:` pass.
  - `existing_service_fit:` pass.
  - `goal_advisor_ready:` pass after approval; the ticket has concrete proof
    route and final checkpoint.
  - `clarifying_questions:` pass; no blocking input for closeout planning.
  - `change_plan_locality:` pass.
  - `qa_strategy_explicit:` pass.
  - `docs_strategy:` pass.
  - `grounding_evidence:` local_only; this closeout concerns repo-local hook
    and projection code.
  - `highest_risk:` claiming live telemetry ingest when only local dry-run or
    outbox proof exists.
  - `fix_or_deferral:` final report must distinguish dry-run/outbox proof from
    live Convex ingest.
