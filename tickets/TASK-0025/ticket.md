---
ticket_id: TASK-0025
title: Add ticket completion scoring program for realtime harness health
phase: planning
status: review
owner: Farplane UI
claimed_by:
priority: high
depends_on:
  - TASK-0019
  - TASK-0020
  - TASK-0027
  - TASK-0028
blocked_by: []
ready: false
approval_required: true
requires_qa: true
requires_demo: false
created_at: 2026-06-28
updated_at: 2026-06-29
next_action: revise with impl-plan after TASK-0027/TASK-0028 land
last_verification: parked follow-up; old dedicated hook and ticket-audit runtime plan removed
---

# TASK-0025: Add Ticket Completion Scoring Program For Realtime Harness Health

## Summary

Add the ticket-completion scoring program after the event and mining foundations
exist. This ticket should consume typed `farplane.ticket.completed` file events
from TASK-0027 and create replayable `.farplane/mine` runs from TASK-0028.

Recommendation: do not implement a dedicated ticket hook, `.ticket-audits`
runtime, or separate scoring job system. Ticket scoring should be a
`ticket_completion` mining mode with one or more mining outputs that can be
reviewed, replayed, and shown on the timeline.

## Scope

- In:
  - Define the first `ticket_completion` mining program.
  - Build the ticket packet source from `ticket.md`, `program.md`,
    `progress.md`, proof artifacts, skill telemetry, and the owning thread or
    session transcript when available.
  - Score completion against ticket scope, skill/program obligations, skipped
    steps, evidence quality, proof freshness, and rough efficiency metrics.
  - Store scorecards as mining outputs under `.farplane/mine/runs/<run-id>/`.
  - Publish compact timeline/harness-health telemetry from the mining output,
    not from raw transcript or ticket bodies.
- Out:
  - No separate hook package.
  - No `.farplane/ticket-audits` storage.
  - No raw transcript, prompt, assistant message, tool output, or full ticket
    body in telemetry.
  - No automatic writes to `docs/LESSONS.md`, `docs/TROUBLES.md`, skills, or
    memory docs in the first scoring slice.
  - No replacement of evals; this mines ticket trajectories, while evals judge
    known cases against expected outcomes.

## Delta

```text
overall_before:
  - Ticket completion can be observed as a future Farplane file event, but no
    ticket-level scoring program consumes it.
overall_after:
  - Completed tickets can trigger replayable mining runs that produce
    reviewable scorecards and timeline events.
why_now:
  - Ticket-shaped work is much higher-signal than arbitrary chats and gives
    Farplane a concrete realtime harness-health window.
first_principles_basis:
  objective: learn from completed units of work, not noisy general chats
  need: score whether the agent followed the ticket/program and proved the work
  constraints: keep hooks cheap, keep telemetry private, keep outputs replayable
  first_viable_slice: one ticket-completion mining program over local tickets
  tradeoff: defer lessons/troubles upserts until scorecards prove useful
  non_goals: separate job runtime, direct provider integrations, broad eval suite
```

## Change Plan

To be filled by `impl-plan` after TASK-0027 and TASK-0028 are implemented. The
plan should reuse the file-event contract and mining-run storage rather than
introducing new runtime primitives.

## Done / Proof

- `farplane.ticket.completed` events can create `ticket_completion` mining run
  requests.
- A ticket packet source is built without leaking raw private content into
  telemetry.
- The scoring program emits at least one structured scorecard output.
- The scorecard can be replayed from the mining run input and source records.
- Timeline/harness-health projection can display the compact score summary.
- Tests cover source construction, score output shape, replay, and privacy
  limits.

## State

- Current: parked behind TASK-0027 and TASK-0028.
- Next: revise this ticket with implementation details after the event and
  mining foundations land.

## Links

- `tickets/TASK-0027/ticket.md`
- `tickets/TASK-0028/ticket.md`
