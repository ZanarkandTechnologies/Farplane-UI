---
ticket_id: TASK-0055
title: Propagate native and ticket-bound Codex thread titles through hooks
phase: implementation
status: done
owner: Farplane UI
claimed_by: codex
priority: high
depends_on: [TASK-0054]
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-07-15T15:00:00Z
updated_at: 2026-07-15T15:34:00Z
next_action: monitor real lifecycle traffic for next-hook native rename latency
last_verification: 19 Core tests, targeted mixed-source regression, 71 focused UI tests, root/Convex typechecks, hook doctor, browser QA, and TAS-A completion review
---

# TASK-0055: Propagate Native And Ticket-Bound Codex Thread Titles Through Hooks

## Summary

Make hook telemetry carry useful Codex conversation titles without requiring a
live app-server connection. Lifecycle hooks will resolve the latest native
Codex `thread_name`, associate explicit `TASK-XXXX` work locally without
uploading prompts, and send ticket metadata through the existing Convex hook
ingress. Farplane UI will prefer the latest native name, then the associated
`[TASK-ID] ticket title`, then existing hook/fallback labels.

## Scope

- `In:`
  - Read the append-only Codex `session_index.jsonl` by exact thread id.
  - Detect explicit ticket ids locally on root `UserPromptSubmit` events.
  - Read ticket title from canonical active/archive `ticket.md` frontmatter or H1.
  - Atomically write one display-only binding per thread under `.farplane/state/thread-title-bindings/`.
  - Publish sanitized native/ticket display metadata through `/telemetry/hooks`.
  - Project title provenance and freshness into observed workers.
- `Out:`
  - Uploading prompts, transcripts, or rollout contents.
  - Polling SQLite or requiring the app server for rendering.
  - A background watcher/daemon for title changes.
  - Automatically renaming unticketed conversations.
  - Adding an unused app-server rename method before a real association-control caller exists.
  - Writing display-only bindings into execution-metrics association logs.

## Delta

```text
overall_before:
  - Hooks know thread ids but usually receive no title.
  - Farplane ticket-thread association is reconstructed later for metrics only.
  - UI app-server summaries can read session_index names, but hook-only Convex presence cannot.
overall_after:
  - Every root lifecycle hook resolves the latest native thread name locally.
  - Explicit ticket work creates a live display-only binding and sanitized telemetry metadata.
  - Hook-only UI renders native names or canonical ticket fallback titles.
first_principles_basis:
  objective: make conversation identity accurate from event data alone
  need: operators must distinguish active conversations without connecting the UI to app-server state
  root_cause: Codex persists names outside hook payloads and Farplane associations are completion-only
  constraints: no prompt persistence, no private SQLite scraping, no daemon, no mandatory app server
  first_viable_slice: enrich existing lifecycle rows and existing raw telemetry projections
  proof_or_falsification: one native name, one ticket fallback, and one generic fallback resolve deterministically with zero prompt field
  tradeoff: a rename with no later lifecycle hook reaches Convex on the next hook rather than instantly
  non_goals: global Codex rename synchronization or a second title database
```

## Change Plan

```text
architecture_signatures:
  module_level:
    - Core hook publisher / resolve_thread_name(codex_home, thread_id): native title?
    - Core hook publisher / resolve_ticket_title_binding(project_root, prompt, thread_id): binding metadata?
    - Convex projection / resolveObservedTitle(payload, current): display title + provenance
    - UI provider / mergeObservedCodexWorkerRows(rows): newest state + strongest title
  main_flow:
    - UserPromptSubmit -> local title/ticket resolution -> per-thread binding replace -> hookTelemetryEvents -> observed worker -> office roster
  data_flow:
    - session_index.thread_name -> payload.nativeThreadTitle -> worker.displayName
    - ticket.title -> payload.ticketDisplayTitle -> worker.displayName + worker.titleSource
    - prompt -> local TASK id extraction only; prompt never crosses telemetry boundary
  builder_freeform_boundary:
    - Helper/test structure is builder-owned unless it changes the per-thread binding schema, execution-metrics semantics, prompt privacy, or app-server optionality.
```

### Change 1: Enrich lifecycle events and persist live association

```text
fixes:
  - hook payloads lack native titles and no live display-only ticket binding exists
before:
  - farplane_console_ping forwards only title fields already present in a hook event
after:
  - publisher resolves session-index names and a deterministic display-only ticket binding locally
read:
  - path: ../Farplane/hooks/farplane_console_ping.py
    reason: canonical lifecycle telemetry publisher
  - path: ../Farplane/bin/runtime/user_turn.py
    reason: existing project discovery, TASK id, ticket path, and frontmatter helpers
write:
  - path: ../Farplane/hooks/farplane_console_ping.py
    change: bounded session-index lookup, strict ticket resolution, per-thread atomic binding, sanitized fields
  - path: ../Farplane/bin/tests/test_farplane_console_ping.py
    change: native/ticket/fallback/privacy/idempotency coverage
operation:
  - read latest matching append-only name
  - on root UserPromptSubmit only, dedupe TASK matches and bind only when exactly one id resolves to exactly one canonical active-or-archive ticket
  - reject zero/multiple ids, active/archive collisions, malformed ids, and any path outside the project ticket roots
  - normalize control characters/whitespace and cap native/ticket/display titles at 120 characters
  - atomically replace `.farplane/state/thread-title-bindings/<safe-thread-id>.json`; separate files prevent cross-thread lost updates
  - on later root lifecycle hooks, reload the existing binding by exact thread id
signature_or_type_impact:
  - binding schema: version, threadId, ticketId, ticketPath, ticketTitle, ticketDisplayTitle, observedAt, source
  - payload gains nativeThreadTitle, ticketId, ticketTitle, ticketDisplayTitle, titleSource
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - Python fixtures for duplicate session-index rows, active/archive collision, multi-ticket prompt rejection, two-thread atomic writes, malformed files, and absent prompt in output/errors/artifacts
failure_modes:
  - stale/malformed local index, ambiguous ticket, unwritable binding state, subagent falsely associated
```

### Change 2: Project provenance-aware titles through Convex

```text
fixes:
  - hook-only observed workers cannot use native or ticket-bound names
before:
  - projection considers threadTitle/title then a generic fallback
after:
  - projection considers nativeThreadTitle, ticketDisplayTitle, existing hook titles, then fallback while preserving stronger provenance across sparse/lower-priority rows
read:
  - path: convex/modules/hookTelemetry/projections.ts
    reason: observed worker identity/title owner
write:
  - path: convex/modules/hookTelemetry/projections.ts
    change: provenance-aware title precedence
  - path: convex/modules/hookTelemetry/hookTelemetry.test.ts
    change: native/ticket/generic ordering and lifecycle folding coverage
operation:
  - reuse the raw telemetry table; add no title table or migration
signature_or_type_impact:
  - ObservedCodexWorker gains titleSource=native|ticket|hook|agent|fallback; storage schema unchanged
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - focused projection tests for equal-priority rename updates and lower-priority non-downgrade
failure_modes:
  - ticket fallback masks explicit native rename; sparse Stop erases title
```

### Change 3: Preserve stronger titles while merging observation sources

```text
fixes:
  - a newer generic local observation can overwrite an older native-titled Convex observation
before:
  - merge selects the newest whole worker row
after:
  - merge takes state/freshness from the newest row and displayName/titleSource from the strongest provenance, using recency as the equal-priority tie-break
read:
  - path: ui/src/providers/office-data-refresh.ts
    reason: Convex/local observation merge owner
write:
  - path: ui/src/providers/office-data-refresh.ts
    change: provenance-aware merge
  - path: ui/src/providers/office-data-provider.test.ts
    change: older native title plus newer generic state coverage
operation:
  - reuse one shared title priority helper from the projection rather than duplicating precedence
signature_or_type_impact:
  - mergeObservedCodexWorkerRows preserves titleSource alongside displayName
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - provider merge test proves newest status/timestamp plus strongest title
failure_modes:
  - equal-priority newer native rename fails to replace an older native name; generic row downgrades title
```

## Done

```text
done_when:
  - reinstall/relink continues to point at the repo-owned enriched publisher
  - latest session-index native title renders from hook telemetry without app-server state
  - explicit single-ticket root prompt atomically persists one per-thread display binding and renders [TASK-ID] title when no native title exists
  - ambiguous/multiple/colliding ticket prompts persist no binding and emit no ticket metadata
  - native name outranks ticket fallback and sparse Stop rows retain the chosen title
  - no telemetry payload contains prompt or transcript text
  - subagents and evals remain excluded from durable roster behavior
  - focused tests, typechecks, hook smoke, browser QA, and independent review pass
```

Proof completed:

- Core resolves exact-id native names, writes isolated per-thread ticket bindings,
  and emits no prompt/transcript content.
- Core and local observations share canonical machine/project/thread identity;
  a production-shaped regression merges them into one worker.
- Native, ticket, hook, agent, and fallback precedence survives sparse/newer rows.
- Hook-only browser QA renders both native and canonical ticket titles without
  app-server configuration.
- Installed hooks remain symlinked to repo-owned Farplane sources.
- Independent completion review: TAS-A / pass.

## QA Strategy

```text
qa_strategy:
  proof_weight: qa + review
  checks:
    - focused Core publisher tests
    - focused Convex projection/provider tests
    - root and Convex typechecks
    - hook install/list/doctor smoke and linked-source persistence
    - downstream primitive-metrics regression proving display bindings do not change execution association/worker metrics
  manual:
    - append two native names for one session and verify latest name reaches hook-only office
    - use a TASK prompt with no native name and verify canonical ticket display title plus the per-thread binding JSON file
    - inspect captured telemetry, stderr, and binding artifacts to prove prompt/transcript absence
  delegated_lanes:
    - independent implementation review
    - hook-only browser QA
  review:
    - rubric: implementation, architecture, evidence-quality
      required_tas: TAS-A
  evidence:
    - tickets/TASK-0055/artifacts/core-title-hook.json
    - tickets/TASK-0055/artifacts/title-binding-concurrency.json
    - tickets/TASK-0055/artifacts/browser-qa/
    - tickets/TASK-0055/artifacts/reviews/
  goal_advisor_inputs:
    proof_route: publisher fixtures -> projection tests -> live hook smoke -> hook-only browser title states
    final_evidence: native title and ticket fallback rendered with prompt absent
    final_checkpoint: reviewer reconciles privacy, per-thread binding concurrency, metrics isolation, source precedence, and reinstall ownership
  residual_risk:
    - native rename reaches Convex on the next lifecycle hook when no app-server subscriber is present
    - session_index is append-only and may contain malformed historical lines
```

Grounding evidence: current official Codex manual/app-server protocol,
maintained OpenAI Codex session-name behavior, the live local
`session_index.jsonl` format, official Convex rules fallback, and existing
Farplane hook/projection tests.

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - ../Farplane/docs/farplane-framework/hooks-and-runtime.md
    - convex/modules/hookTelemetry/README.md
    - docs/features/FEAT-0115-office-kits-presence-and-camera.md
    - docs/HISTORY.md
  no_docs_reason:
  validation:
    - docs name session-index enrichment, live association metadata, precedence, privacy, and next-hook rename latency
```

## Agent Contract

- `Open:` `/office` with every app-server URL unset.
- `Test hook:` root lifecycle payloads for native title, ticket fallback, and generic fallback.
- `Inspect:` local per-thread binding JSON, raw telemetry payload, and rendered employee name.
- `Key screens/states:` native-titled root; ticket-titled root; no prompt in telemetry.
- `Design baseline:` no layout change; existing selected-agent label and chat title.
- `Expected artifacts:` focused logs, raw sanitized payload, screenshot, reviewer receipt.

## Links

- `program:` none
- `progress:` none
- `visual companion:` `tickets/TASK-0055/diagrams.md`
- `artifacts:` `tickets/TASK-0055/artifacts/`
- `review:` `tickets/TASK-0055/artifacts/reviews/completion-review.md`
- `refs:` `tickets/TASK-0054/ticket.md`, `docs/features/FEAT-0115-office-kits-presence-and-camera.md`

## Notes

- `Blast radius:` Core lifecycle hook, display-only per-thread binding state, raw telemetry projection, observation-source merge.
- `Rollback:` remove hook enrichment, display bindings, and provenance-aware projection logic; the raw telemetry schema remains compatible.
- `Minimal implementation:` reuses runtime ticket parsing, the existing hook request, raw telemetry table, worker projection, and provider merge; a new per-thread binding directory is required to avoid corrupting execution-metrics semantics.
- `Plan QA:` minimal version pass; reuse pass; least parameters pass; architecture signatures pass; proof route pass; initial reviewer TAS-B findings reconciled; re-review TAS-A pass.
