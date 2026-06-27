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
ready: false
approval_required: true
requires_qa: true
requires_demo: false
created_at: 2026-06-26
updated_at: 2026-06-26
next_action: trust the updated repo hooks with Codex /hooks, then exercise one real Stop event against the local telemetry endpoint
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
    - `miner.window.updated`
    - `miner.agent.skipped`
    - `miner.agent.queued`
    - `miner.agent.launched`
    - `miner.agent.failed`
    - `miner.agent.completed`
    - `learning.lesson.observed`
    - `learning.trouble.observed`
    - `decision.observed`
  - Include `ticketId`, `sessionId`, `turnId`, `projectId`, `cwd`,
    `reviewRunPath`, `source`, `eventName`, `eventAt`, and a stable `eventKey`
    wherever the source can infer them safely.
  - Keep the Stop-hook fast path bounded:
    - every Stop emits cheap miner lifecycle metadata
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
    - miner.window.updated
    - miner.agent.skipped
    - miner.agent.queued
    - miner.agent.launched
    - miner.agent.failed
    - miner.agent.completed
    - learning.lesson.observed
    - learning.trouble.observed
    - decision.observed
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

## Done / Proof

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
