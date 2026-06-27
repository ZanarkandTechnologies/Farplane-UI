---
ticket_id: TASK-0020
title: Build Chat History Mining Programs Platform
phase: done
status: done
owner: Farplane UI
claimed_by:
priority: medium
depends_on:
  - TASK-0019
blocked_by: []
ready: true
approval_required: true
requires_qa: true
requires_demo: false
created_at: 2026-06-26
updated_at: 2026-06-28
next_action: done
last_verification: implemented Thread Data backfill platform; five-source dry-run backfill-mqwl7gct has output.json evidenceSpans, redaction.md reports, run counts, browser screenshots, and privacy-gated promotion
---

# TASK-0020: Build Chat History Mining Programs Platform

## Summary

Create a reusable Farplane feature for mining old Codex chats with different
operator-authored programs. Each program defines what to extract, which sources
to scan, what output artifacts to produce, how progress is tracked, and how the
UI renders the resulting outputs.

This is distinct from the live Stop-hook rolling-window path in TASK-0019.
TASK-0019 captures current learning/decision events. This ticket is the
historical/programmatic mining surface: run a named program over selected chat
history, watch progress, review outputs, and optionally publish compact summary
events into telemetry.

Trajectory mining is the first strong example program, not the whole product.
Other programs could mine decisions, lessons, troubles, taste signals, progress
summaries, ticket handoff quality, failure modes, acceptance labels, or eval
cases from the same chat source layer.

## Scope

- In:
  - Define the mining program platform contract:
    - program registry
    - source selector
    - run queue and progress state
    - worker contract
    - output artifact schema
    - output browser/view model
    - review and promotion state
  - Support multiple program objectives, starting with one or two bundled
    examples:
    - `trajectory-v1`: initial request -> negotiation -> accepted plan -> proof
    - `decision-v1`: key decisions with ticket/session/source spans
    - `learning-v1`: lessons/troubles/failure modes
    - `taste-v1`: preference and acceptance signals
    - `progress-v1`: work progress summaries and handoff candidates
  - Create an index/run shape such as
    `.farplane/mining/runs/<run-id>/run.json` plus an operator-readable
    `report.md`, with per-source rows for `thread_id`, `title`, `date_range`,
    `source`, `status`, `output_path`, `privacy_flags`, `reviewer_verdict`, and
    `error`.
  - Define source selectors for project, ticket id, session id, date range,
    explicit transcript allowlist, weekly thread index, and message-window
    snapshots.
  - Define the generic worker signature:
    `chat_history_miner(program, source_ref) -> output_artifacts + redaction_report + progress_event`.
  - Define output placement and browsing:
    - per-run outputs under `.farplane/mining/runs/<run-id>/outputs/`
    - normalized `output.json` for UI indexing
    - human-readable `output.md` for review
    - redaction/privacy report per source
    - run report with counts and verdicts
  - Add dry-run and fixture modes before any mining run can publish or promote
    outputs.
  - Optionally publish compact summary events into the same hook telemetry
    ingest path used by TASK-0019, with source `chat_history_mining`.
  - Track run identity, program id/version, source transcript hash, progress
    state, output count, rejected count, privacy flag count, duplicate count,
    and reviewer verdicts.
  - Add UI/query shape for:
    - creating or selecting a mining program
    - selecting sources
    - watching run progress
    - browsing outputs by program/run/source/ticket/session
    - reviewing/promoting/rejecting outputs
- Out:
  - No live Stop-hook rolling-window capture; that belongs to TASK-0019.
  - No unbounded scan of all transcripts on first implementation.
  - No raw transcript storage in Convex.
  - No automatic docs, skill, memory, or ticket edits from backfill output.
  - No direct claim that first-pass artifacts are RL data.
  - No hidden chain-of-thought mining; extract observable decision traces and
    source-span-backed conversation structure only.
  - No irreversible import or promotion without dry-run summary, privacy review,
    and reviewer verdict.

## Platform Contract

```text
chat_history_mining(program, source_selector, run_options)
  -> mining_run + output_artifacts + progress_events + review_report

input:
  programId: trajectory-v1 | decision-v1 | learning-v1 | taste-v1 | progress-v1 | custom
  programVersion: semver or date version
  sourceAdapter: codex_session | exported_chat | message_window
  selector:
    projectId?: string
    ticketId?: TASK-*
    sessionId?: string
    dateRange?: start/end
    transcriptPaths?: explicit allowlist
    weeklyIndexPath?: path
  mode: dry-run | publish

worker:
  chat_history_miner(program, source_ref)
    -> output.md + output.json + redaction_report + progress_event

output:
  runId: stable id
  runPath: .farplane/mining/runs/<run-id>/
  reportPath: .farplane/mining/runs/<run-id>/report.md
  sourceCount: number
  completedOutputCount: number
  rejectedSourceCount: number
  privacyFlagCount: number
  duplicateCount: number
  outputsByProgram: artifact refs
```

## Implementation Notes

- Treat this as a reusable mining program runner, not as another Codex Stop
  hook and not as a single hardcoded trajectory loop.
- The first implementation should process a tiny representative set: five
  threads from one week or an explicit allowlist, using one bundled program.
- Program definitions should be versioned artifacts, so new objectives can be
  added without changing the runner.
- The platform should generate reviewable outputs, not silently train models or
  mutate durable skills.
- Source spans are mandatory for every synthetic or interpretive claim.
- Dedupe must use source transcript hash plus program id/version plus output
  hash so reruns are safe.
- Generated artifacts must separate real user signal from AI reconstruction.
- Summary telemetry, if emitted, should mark events as
  `source=chat_history_mining`
  so they do not look like live Stop-hook observations.
- A weekly cadence is a useful operating mode, but the core product is the
  program runner plus run/output UI.

## Done / Proof

```text
done_when:
  - mining program platform contract is documented with program registry, selectors, run state, worker signature, output artifacts, and privacy rules
  - dry-run can process a bounded fixture or explicit source allowlist with at least one bundled program
  - generated outputs cite source spans and separate user signal from AI reconstruction
  - run report summarizes progress, completed outputs, rejected sources, privacy issues, duplicates, and reviewer verdicts
  - UI/query shape can show mining runs, progress, and outputs by program/run/source/ticket/session
  - trajectory mining is represented as one bundled/example program rather than the entire feature

proof:
  checks:
    - npm run test:once -- convex/modules/hookTelemetry
    - npm run test:once -- hooks
    - npx tsc -p convex/tsconfig.json --noEmit
  manual:
    - run dry-run against five fixture/allowlisted sources with the first bundled program
    - inspect generated output.md, output.json, and redaction reports
    - inspect run progress, report counts, and reviewer verdict fields
    - inspect projected UI/query rows and confirm source=chat_history_mining when summary telemetry is emitted
  review:
    - rubric: transcript privacy, source-span traceability, synthetic overreach, program versioning, bounded execution, output browsing, UI provenance clarity
      required_tas: TAS-B
  evidence:
    - mining platform contract docs or README section
    - dry-run report artifact
    - sample program output artifact and redaction report
```

## State

- `next_action:` done
- `blocked:` approval required before implementation
- `latest_verification:` implemented and checked with five-source dry-run
  `.farplane/backfill/jobs/backfill-mqwl7gct`, browser screenshots under
  `.farplane/qa/TASK-0020`, targeted tests, Biome, and root typecheck
- `result:` implemented Thread Data backfill platform with five-source dry-run
  proof and TAS-A completion review

## Links

- `program:` `tickets/TASK-0020/program.md`
- `progress:` `tickets/TASK-0020/progress.md`
- `artifacts:` `tickets/TASK-0020/design.md`, `tickets/TASK-0020/generated-goal-prompt.md`
- `review:` none
- `refs:`
  - `tickets/TASK-0019/ticket.md`
  - `tickets/TASK-0018/ticket.md`
  - `convex/modules/hookTelemetry/README.md`
  - `convex/modules/hookTelemetry/schema.ts`
  - `convex/modules/hookTelemetry/events.ts`
  - `convex/modules/hookTelemetry/projections.ts`
  - `convex/modules/hookTelemetry/queries.ts`
  - `hooks/shared/telemetry-outbox.ts`
  - `supplied Codex attachment: chat-history-mining thread`
  - `related_codex_thread: 019f03fc-65f6-7bc2-9c2b-784ee3ed916f`
