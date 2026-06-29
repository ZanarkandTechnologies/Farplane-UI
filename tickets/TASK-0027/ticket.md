---
ticket_id: TASK-0027
title: Define Farplane file event system for tracked project files
phase: planning
status: review
owner: Farplane UI
claimed_by:
priority: high
depends_on:
  - TASK-0002
blocked_by: []
ready: false
approval_required: true
requires_qa: true
requires_demo: false
created_at: 2026-06-29
updated_at: 2026-06-29
next_action: approve this event-system plan, then run goal-advisor on TASK-0027
last_verification: plan only; file-change listener, hook config, telemetry, and tracked file patterns inspected
---

# TASK-0027: Define Farplane File Event System For Tracked Project Files

## Summary

Turn the current generic file-change summary hook into a typed Farplane file
event capture system. The hook should still support tiny status-bubble
summaries, but its primary durable value becomes structured, replayable file
events for important Farplane project files such as `ticket.md`, `progress.md`,
`harness.md`, `goals.md`, `products.md`, `automations.md`, `bindings.md`, and
memory docs.

Recommendation: keep one local PostToolUse capture surface for Farplane file
events, implemented as an evolution of `hooks/file-change-listener` rather than
a new hook package. The hook captures, classifies, extracts safe metadata diffs,
publishes telemetry, and stays neutral about downstream program routing. It
does not run deep ticket review, durable job queues, or long LLM programs
inline; a later event-programs config will decide which events schedule jobs.

## Scope

- In:
  - Evolve `file-change-listener` toward a Farplane file event listener while
    preserving the existing `file.change.summary` behavior and hook install id.
  - Define event kinds, payloads, metadata extraction rules, privacy limits,
    and per-file parser strategy for tracked Farplane files.
  - Compute frontmatter diffs where frontmatter exists; do not publish full
    frontmatter or raw file bodies by default.
  - Emit typed events such as `farplane.ticket.changed`,
    `farplane.ticket.completed`, `farplane.ticket.progress.changed`,
    `farplane.harness.changed`, and `farplane.bindings.changed`.
  - Keep event payloads factual and free of routing decisions; later
    event-program config owns event-to-job mapping.
  - Make future provider webhooks able to emit the same normalized event shape
    without pretending they are local file changes.
- Out:
  - No deep evaluation, ticket scoring, decision extraction, or backfill worker
    fan-out inside the hook path.
  - No raw file bodies, raw diffs, full prompts, transcripts, tool output, or
    secrets in Convex hook telemetry.
  - No requirement that agents manually log every decision into `progress.md`.
  - No Notion/Linear/GitHub provider implementation in this ticket.
  - No renaming of the installed hook id or installer entry in the first slice.
  - No generic job storage, executor abstraction, queue runner, or
    event-program routing config.

## Delta

- `Before:` `hooks/file-change-listener` watches tracked project paths, asks
  Codex for a 2-4 word status bubble, and publishes `file.change.summary`.
- `After:` the same capture layer emits typed Farplane file events with
  structured metadata diffs, optional tiny summaries, and stable `eventKey`s.
  Timeline and future job processors can subscribe
  to typed events rather than reverse-engineering generic file summaries.
- `Why now:` ticket completion auditing, harness health, timeline views, and
  future Kanban providers all need one clean event contract. A file event layer
  is the right primitive because Farplane projects already declare important
  files in `farplane/manifest.json`.
- `First-principles basis:` capture should be synchronous and cheap. File
  events are facts about project state changes; routing config and jobs are
  separate interpretations derived from those facts.

## Change Plan

### Change 1: typed event contract and parser registry

```text
fixes:
  - Give Farplane tracked file changes a stable semantic contract instead of
    only a tiny display summary.
before:
  - changedTrackedFilesFromPayload() returns tracked paths and each path becomes
    `file.change.summary`.
after:
  - each matched path resolves to a file kind, parser strategy, event name,
    metadata diff, and optional summary.
read:
  - path: hooks/file-change-listener/handler.ts
    reason: reuse path extraction, metadata resolution, eventKey construction,
      and outbox publish flow.
  - path: hooks/shared/project-hook-config.ts
    reason: reuse tracked path resolution from manifest/config/env.
  - path: farplane/manifest.json
    reason: source list of tracked project files and framework core files.
write:
  - path: hooks/file-change-listener/
    change: add file-kind registry, metadata snapshot state, typed event
      creation, and typed publish path while preserving existing summary event
      compatibility.
  - path: hooks/file-change-listener/HOOK.md
    change: document typed event semantics, payload privacy, and summary mode.
operation:
  - Resolve file kind from path pattern.
  - Read bounded current file content only for parser metadata.
  - Compare against local `.farplane/file-events/state/*.json` snapshot when
    available to compute diffs.
  - Store only sanitized parser snapshots locally: content hash, frontmatter
    subset hashes/previews, heading hashes, append cursor, and selected entity
    ids.
  - Publish one typed event per changed file and optionally the legacy summary
    event for UI bubbles.
signature_or_type_impact:
  - `classifyFarplaneFile(path) -> FarplaneFileKind`
  - `parseFarplaneFileEvent(kind, path, before?, after) -> FarplaneFileEvent`
  - `publishFarplaneFileEventCandidates(candidates, options) -> publish_result`
  - `FarplaneFileEvent { schemaVersion, eventName, source, projectId?,
    sessionId?, threadId?, path?, provider?, externalId?, entityKind, entityId?,
    contentHash, frontmatterDiff?, changedFields?, sectionHints?, terminal?,
    summary?, eventAt, eventKey }`
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - Unit tests cover path classification, no raw-body payloads, stable keys,
    and compatibility with existing summary candidates.
failure_modes:
  - Hook payload grows too large; enforce compact diffs and summaries.
  - Registry becomes too clever; keep parser outputs small and typed.
```

### Change 2: file kinds and payload rules

```text
fixes:
  - Define which Farplane files are worth tracking and how each is parsed.
before:
  - tracked paths are treated mostly the same.
after:
  - important file families have explicit metadata extraction rules and event
    names.
read:
  - path: tickets/templates/ticket.md
    reason: ticket frontmatter and sections define lifecycle/proof state.
  - path: farplane/harness.md
    reason: harness policy changes are timeline-worthy.
  - path: farplane/goals.md
    reason: goal changes are product direction events.
  - path: farplane/products.md
    reason: product row changes affect project strategy.
  - path: farplane/automations.md
    reason: automation cadence/config changes are operational events.
  - path: farplane/bindings.md
    reason: provider/binding changes affect runtime and integrations.
  - path: docs/MEMORY.md
    reason: durable invariant changes should appear in timeline.
  - path: docs/TROUBLES.md
    reason: repeated failure entries are learning events.
  - path: docs/LESSONS.md
    reason: distilled learning entries are learning events.
write:
  - path: hooks/file-change-listener/file-event-registry.ts
    change: add path-to-kind registry and parser selection.
operation:
  - `tickets/TASK-*/ticket.md`: parse frontmatter diff, section hints,
    terminal status, ticket id, status/phase/next_action changes; emit
    `farplane.ticket.completed` when the terminal flag flips false -> true.
  - `tickets/TASK-*/program.md`: parse heading/fenced block hash changes and
    emit `farplane.ticket.program.changed`.
  - `tickets/TASK-*/progress.md`: parse append/heading hints and emit
    `farplane.ticket.progress.changed`; do not require decision logging.
  - `farplane/harness.md`: parse headings and emit `farplane.harness.changed`.
  - `farplane/goals.md`: parse headings/task-ish rows and emit
    `farplane.goals.changed`.
  - `farplane/products.md`: parse headings/product rows and emit
    `farplane.products.changed`.
  - `farplane/automations.md`: parse headings/tables and emit
    `farplane.automations.changed`.
  - `farplane/bindings.md`: parse frontmatter and fenced project-bindings
    block; emit `farplane.bindings.changed` when provider fields change.
  - `farplane/manifest.json`, `hooks.json`, `pm.json`: parse JSON pointer-ish
    changed keys and emit config events.
  - `docs/MEMORY.md`, `LESSONS.md`, `TROUBLES.md`, `HISTORY.md`, `TASTE.md`:
    parse append/section hints and emit memory/learning/taste events.
signature_or_type_impact:
  - `FrontmatterDiff { changed, added, removed }`
  - `ChangedField { path, beforeHash?, afterHash?, beforePreview?, afterPreview? }`
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - Fixture tests for ticket terminal transition, bindings provider change,
    JSON config change, progress append, and memory append.
failure_modes:
  - Markdown parsing becomes brittle; prefer frontmatter/heading/append hints
    over full semantic parsing.
  - Provider webhooks may not have local paths; payload supports provider and
    externalId without path.
```

### Change 3: timeline and provider-ready integration

```text
fixes:
  - Make file events visible and future-provider-compatible without making UI
    or hook code provider-specific.
before:
  - Raw hook telemetry exists, but timeline rows mainly consume bespoke
    projections.
after:
  - file events share one payload shape and can be rendered as timeline rows or
    consumed later by an event-program router.
read:
  - path: convex/modules/hookTelemetry/learningTimeline.ts
    reason: reuse existing hook telemetry projection pattern.
  - path: ui/src/modules/team-workspace/components/timeline-tab.tsx
    reason: file events should be expandable timeline rows.
write:
  - path: convex/modules/hookTelemetry/learningTimeline.ts
    change: project `farplane.*` file events into compact timeline rows.
  - path: ui/src/modules/team-workspace/components/timeline-tab.tsx
    change: show file event rows only if it fits existing timeline structure;
      otherwise defer richer UI to a follow-up.
operation:
  - Timeline row shows event label, entity id, changed fields, summary, and
    expandable compact payload.
  - Future provider webhooks publish the same `FarplaneFileEvent` shape with
    `source=provider_webhook`, `provider`, and `externalId`.
  - Do not rework the Team Timeline UI in this ticket unless the existing
    projection path can render typed events with a small local change.
signature_or_type_impact:
  - projection row adds `sourceEventKey`, `entityKind`, `entityId`, and compact
    `changedFields`.
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - Projection tests cover local file source and provider-webhook-shaped event.
failure_modes:
  - Timeline becomes noisy; v1 should collapse low-value file changes and
    highlight terminal/provider/policy events first.
```

## Done

```text
done_when:
  - tracked Farplane file edits emit typed `farplane.*` events in addition to
    or instead of legacy `file.change.summary` bubble events
  - ticket terminal status produces a compact event with `terminal: true`,
    changed frontmatter fields, ticket id, and no raw body
  - frontmatter diffs publish changed keys only, not entire frontmatter blobs
  - parser registry covers tickets, ticket program/progress, key `farplane/*`
    docs, key memory docs, and JSON config files
  - event payloads are provider-ready with `source`, `provider?`, `externalId?`,
    and `path?`
  - event payloads contain no job routing decisions
  - timeline projection can render at least ticket-completion and provider
    config-change events
  - existing `file.change.summary` tests and publishing behavior continue to
    pass
done_evidence:
  - added `hooks/file-change-listener/file-event-registry.ts` with typed file
    kind classification, compact snapshots, frontmatter/JSON changed fields,
    terminal ticket detection, provider-ready event shape, and stable event keys
  - extended `hooks/file-change-listener/handler.ts` and `run.ts` to publish
    typed `farplane.*` events before the legacy summary path while preserving
    `file.change.summary`
  - extended hook config fallback patterns to include `farplane/*.md` and
    `farplane/*.json`
  - projected `farplane.*` telemetry into learning timeline rows with entity
    kind/id, changed fields, source event key, and file path
  - tightened the event family with literal `FarplaneFileEventName` unions,
    Convex `farplaneFileEventPayloadValidator`, `isFarplaneFileEventPayload`
    guards, typed learning timeline branching, and generic telemetry outbox
    envelopes
  - documented capture/processing boundary and privacy limits in
    `hooks/file-change-listener/HOOK.md`,
    `docs/features/FEAT-0002-harness-product-model.md`, and
    `docs/HISTORY.md`
  - tests:
    `npm run test:once -- hooks/file-change-listener hooks/shared` passed
    `npm run test:once -- convex/modules/hookTelemetry` passed
    `npm run typecheck:root` passed
```

## QA Strategy

```text
qa_strategy:
  proof_weight: tests
  checks:
    - npm run test:once -- hooks/file-change-listener hooks/shared
    - npm run test:once -- convex/modules/hookTelemetry
    - npm run typecheck:root
  manual:
    - dry-run a PostToolUse payload for `tickets/TASK-*/ticket.md`
    - inspect emitted typed event payload and legacy summary behavior
    - inspect timeline projection fixture
  delegated_lanes:
    - review lane for privacy and event taxonomy
  review:
    - rubric: compact payloads, stable event keys, parser simplicity,
      provider readiness, no inline deep work
      required_tas: TAS-B
  evidence:
    - fixture payloads and expected events
    - projection test output
    - sample event JSON with redacted/hashed fields
  goal_advisor_inputs:
    proof_route: focused hook tests + projection tests + privacy review
    final_evidence: sample typed events and test output
    final_checkpoint: reviewer confirms no raw file bodies or secrets enter
      telemetry
  residual_risk:
    - initial parser taxonomy may need tuning after real timeline noise is
      visible
    - local snapshot state can miss a "before" value on first observation; emit
      `firstObservation: true` and avoid claiming a diff when no prior snapshot
      exists
```

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - hooks/file-change-listener/HOOK.md
    - docs/features/FEAT-0002-harness-product-model.md
    - docs/HISTORY.md
  no_docs_reason:
  validation:
    - docs explain capture vs processing boundary and provider-ready event shape
```

## Links

- `program:`
- `progress:`
- `artifacts:`
- `review:`
- `refs:`
  - `hooks/file-change-listener/handler.ts`
  - `hooks/shared/project-hook-config.ts`
  - `hooks/shared/telemetry-outbox.ts`
  - `farplane/manifest.json`
  - `tickets/templates/ticket.md`
  - `convex/modules/hookTelemetry/learningTimeline.ts`

## Notes

- `Key decision:` capture/classification stays synchronous, cheap, and factual;
  later event-program routing decides which jobs to run.
- `Frontmatter diff:` publish changed frontmatter fields only, using previews
  or hashes where values could be long or sensitive.
- `Provider future:` local file changes and future Notion/Linear/GitHub
  webhooks should converge on the same event shape.
- `Compatibility:` keep `file.change.summary` while typed event consumers are
  introduced, then decide whether bubbles should be derived from typed events.
- `Minimal implementation claim:` this ticket is the smallest useful file-event
  slice: typed capture, compact parser snapshots, frontmatter diffs, event
  publishing, and projection tests. Durable queues, executors, audit jobs, and
  event-program routing are deliberately out of scope.
- `Grounding evidence:` local-only; based on `hooks/file-change-listener`,
  existing hook tests, `hooks/shared/project-hook-config.ts`, hook telemetry
  learning timeline projection, `tickets/templates/ticket.md`, and
  `farplane/manifest.json`.
- `plan_qa:`
  - `minimal_required_version:` pass; implements typed capture only, not routing
    or jobs.
  - `reuse_before_new_surface:` pass; extends existing file-change hook and
    outbox publisher.
  - `least_parameters:` pass; no new env/config knobs required in v1.
  - `new_files_functions_justified:` pass; registry/parser files isolate
    metadata extraction from the existing hook transport.
  - `minimal_impl_plan_claim:` pass.
  - `existing_service_fit:` pass; no new hook package or installer id.
  - `goal_advisor_ready:` pass after approval.
  - `clarifying_questions:` pass; user selected TASK-0027 only and split jobs
    and routing config out of scope.
  - `change_plan_locality:` pass.
  - `qa_strategy_explicit:` pass.
  - `docs_strategy:` pass.
  - `grounding_evidence:` local_only.
  - `highest_risk:` noisy or oversized events from broad Markdown parsing.
  - `fix_or_deferral:` keep parser outputs compact; use frontmatter/heading/
    append hints instead of full semantic Markdown analysis.

## Run Hints

```text
Likely size: normal
Goal recommendation: recommend
Budget hint: focused local implementation plus hook/projection tests; no browser
  QA unless timeline UI is touched
Compute hint: local_shared
Planning hint: impl_plan complete after approval
QA source: QA Strategy
Batchability: single-ticket
Batch reason: file-event capture is a shared hook boundary and should land
  before any event-program router consumes typed events
Human inputs/assets: none
Credentials / external access: none
```
