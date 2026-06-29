---
ticket_id: TASK-0018
title: Self Event Logs in Farplane UI telemetry
phase: planning
status: review
owner: Farplane UI
claimed_by:
priority: high
depends_on: []
blocked_by: []
ready: false
approval_required: true
requires_qa: true
requires_demo: false
created_at: 2026-06-26
updated_at: 2026-06-26
next_action: review this UI-owned ticket and decide whether to implement the self-event ingest/projection slice here
last_verification: scoped against Farplane UI hook telemetry module, runtime telemetry module, UI telemetry panels, and Core TASK-0233; implementation not started
---

# TASK-0018: Self Event Logs in Farplane UI telemetry

## Summary

Extend Farplane UI's existing hook telemetry system into the owner surface for
Self Event Logs: compact observations about decisions, drift checks, learning
signals, tickets, Pulse actions, and interval reports. The first slice should
reuse `hookTelemetryEvents`, `/telemetry/hooks`, `/telemetry/hooks/batch`, and
projection reducers rather than creating a second raw telemetry store.

Farplane Core remains the producer of local hook/backfill events and the
local-first audit fallback. Farplane UI owns ingestion, storage/query shape,
project/team timeline projections, and the future Self Improvement tab.

## Scope

- In:
  - Define a `self.event.*` event taxonomy that fits the existing
    `hookTelemetryEvents` payload model.
  - Extend or document the `/telemetry/hooks` ingest contract for self events
    without creating a feature-specific raw table.
  - Add projection reducers for a project/team self-event timeline, grouped by
    drift level, source, event kind, ticket, skill, severity/status, and time.
  - Define the Self Improvement tab view model: Timeline, Inbox, Decisions,
    Drift, and Reports.
  - Decide which events are hook-captured versus backfilled:
    - Level 0: start/stop hooks, PostToolUse hooks, decision observations,
      lesson/trouble observations, ticket-created/status-changed events.
    - Level 1: Goal drift guard, proof gap, blocked state, phase change, and
      completion-review events.
    - Level 2: Pulse, daily interval, weekly interval, report-created,
      reward-reconciled, and learning-backpropagation events.
  - Add focused tests for ingest compatibility, projection reducers, and
    privacy boundaries.
  - Link the Core producer-side plan from
    `Farplane Core tickets/TASK-0233/ticket.md`.
- Out:
  - No new raw Convex table unless `hookTelemetryEvents` is proven unable to
    represent the event shape.
  - No raw prompts, transcripts, assistant outputs, tool outputs, repo file
    contents, or secrets in telemetry.
  - No full visual polish pass for the Self Improvement tab in this ticket
    unless the ingest/projection slice is already complete.
  - No automatic skill edits, memory rewrites, ticket creation, or retrospective
    scoring from telemetry alone.
  - No Farplane Core hook implementation inside this repo except fixture
    payloads or documented producer contracts.

## Ownership Recommendation

```text
Farplane Core
  -> producer contracts, local JSONL fallback, hook/backfill emitters

Farplane UI convex/modules/hookTelemetry
  -> raw append-only storage and HTTP ingest for self-event envelopes

Farplane UI projection modules
  -> timeline, inbox, decisions, drift, reports, office bubbles, team views

Farplane UI ui/src/modules/telemetry or ui/src/modules/self-improvement
  -> operator-facing Self Improvement tab
```

This should be a Farplane UI ticket because the durable product value is the
team/project timeline and Self Improvement UI. Core should not invent a
parallel product telemetry model when UI already owns `/telemetry/hooks` and
`hookTelemetryEvents`.

## Done / Proof

```text
done_when:
  - self-event taxonomy is documented with event names, drift levels, required
    fields, optional fields, privacy limits, and producer examples
  - ingest path accepts representative self-event payloads through the existing
    telemetry route or a justified sibling route under the same service
  - projection reducers return a compact self-event timeline and at least one
    inbox/decision/drift grouping shape
  - UI tab contract names where the Self Improvement surface appears globally
    and inside a team/project panel
  - Core TASK-0233 can implement producer hooks/backfills without guessing the
    UI event contract

proof:
  checks:
    - npm run test:once -- convex/modules/hookTelemetry
    - npm run test:once -- telemetry team-panel
    - npx tsc -p convex/tsconfig.json --noEmit
  manual:
    - inspect fixture self-event rows in hook telemetry explorer/projection
    - inspect redaction: no raw prompts, transcripts, tool outputs, or repo
      contents
  review:
    - rubric: telemetry privacy, module ownership, projection correctness
      required_tas: TAS-B
  evidence:
    - self-event taxonomy/spec section
    - projection fixture or test output
    - Core producer handoff link
```

## State

- `next_action:` review this UI-owned ticket and decide whether to implement the
  self-event ingest/projection slice here
- `blocked:` approval required before implementation
- `latest_verification:` scoped against existing `convex/modules/hookTelemetry`,
  `/telemetry/hooks`, `ui/src/modules/telemetry`, `ui/src/modules/hook-telemetry`,
  `docs/features/FEAT-0001-operator-intelligence-modules-roadmap.md`, and Core
  `TASK-0233`
- `result:` pending

## Links

- `program:` none
- `progress:` none
- `artifacts:` none
- `review:` none
- `refs:`
  - `convex/modules/hookTelemetry/README.md`
  - `convex/modules/hookTelemetry/schema.ts`
  - `convex/modules/hookTelemetry/events.ts`
  - `convex/modules/hookTelemetry/projections.ts`
  - `convex/modules/hookTelemetry/queries.ts`
  - `ui/src/modules/telemetry/README.md`
  - `ui/src/modules/hook-telemetry/README.md`
  - `docs/features/FEAT-0001-operator-intelligence-modules-roadmap.md`
  - `Farplane Core tickets/TASK-0233/ticket.md`
