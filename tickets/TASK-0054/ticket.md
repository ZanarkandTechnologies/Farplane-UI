---
ticket_id: TASK-0054
title: Make Codex office presence and lineage hook-canonical
phase: done
status: done
owner: Farplane UI
claimed_by: codex
priority: high
depends_on: [TASK-0003, TASK-0008]
blocked_by: []
ready: false
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-07-15T00:00:00Z
updated_at: 2026-07-15T10:10:00Z
next_action: none; retain native rename-hook and nested-parent gaps as accepted upstream limitations
last_verification: completion review TAS-A after 75 focused UI tests, 43 Core tests, root and Convex typechecks, hook-only browser and visual QA PASS
---

# TASK-0054: Make Codex Office Presence And Lineage Hook-Canonical

## Summary

Complete the telemetry-first direction from TASK-0003: Codex hooks, not an
app-server connection, own the office roster, titles available in hook
metadata, lifecycle state, and thread lineage. Keep app-server integration as
an optional control path, isolate eval invocations before they create sessions
or telemetry, and keep short-lived subagents out of the durable employee roster.

## Scope

- `In:`
  - Install and publish sanitized `SubagentStart` and `SubagentStop` events.
  - Preserve native `agent_id`, `agent_type`, parent session, runtime purpose,
    and available title metadata in hook telemetry.
  - Make native Codex eval agent/judge/baseline runs hookless and ephemeral.
  - Use one five-minute presence window for Convex and local hook sources.
  - Merge Convex and local hook observations instead of replacing one source.
  - Promote only non-eval root conversations into the employee roster.
  - Project native subagents as typed spawned lineage, not durable employees.
  - Prefer hook thread titles over the generic `codex` agent label.
  - Preserve created/forked lineage as separate persistent edge kinds.
- `Out:`
  - Making app-server mandatory for rendering.
  - Scraping private Codex session storage for titles.
  - Treating `SubagentStop` as permanent child deletion.
  - Guaranteeing isolation for arbitrary custom eval shell templates.
  - Replacing app-server APIs used for explicit live control.

## Delta

```text
overall_before:
  - Convex observations replace local observations and remain visible for 15 minutes.
  - Refresh extends stale presence from now instead of the observation time.
  - Generic codex labels mask available thread titles.
  - Eval runs persist sessions and emit ordinary lifecycle hooks.
  - Native subagents are either absent from lineage or promoted as full employees.
overall_after:
  - Hook observations are merged, title-aware, and expire five minutes after lastSeenAt.
  - Native eval invocations are ephemeral, hookless, and notify-free.
  - Root conversations alone own roster employees; spawned children remain typed lineage.
  - Rendering works with no Codex app-server connection.
why_now:
  - The current office swarm is proven to be persisted eval threads plus stale hook presence.
first_principles_basis:
  objective: make the office an honest visualization of hook-observed conversations and lineage
  need: operator trust requires correct identity, recency, and parentage without a control connection
  assumptions: native hooks continue to provide session_id plus subagent agent_id; titles are best-effort hook metadata
  root_cause: incomplete hook installation, unsafe eval runner flags, inconsistent recency, and roster promotion of ephemeral rows
  constraints: one raw hook store; no transcript persistence; app-server stays optional control-only
  first_viable_slice: fix producers, projection, roster eligibility, recency, and typed spawned graph edges
  proof_or_falsification: root + subagent + eval fixtures render one titled root, one spawned edge, and zero eval/subagent employees without app-server
  tradeoff: hook-only title coverage is best-effort until Codex exposes a rename hook
  non_goals: session-store scraping, process management, or a second lineage database
```

## Change Plan

```text
architecture_signatures:
  module_level:
    - Farplane Core hooks / publish_codex_lifecycle(payload, env): sanitized hook telemetry envelope
    - eval runner / codex_extra_args(profile, extras): effective isolated Codex arguments
    - Convex hook projection / hookTelemetryRowsToObservedCodexWorkers(rows): typed recent workers
    - Convex lineage projection / hookTelemetryRowsToThreadLineageGraph(rows): created + forked + spawned graph
    - UI provider / mergeObservedCodexWorkersIntoUnifiedOfficeModel(model, workers, now): hook-canonical root roster
  main_flow:
    - Codex hook -> Core publisher -> hookTelemetryEvents -> Convex projection -> Office provider -> roster/lineage effect
  data_flow:
    - session_id -> parent session identity
    - agent_id -> spawned child identity
    - runtime purpose=eval -> excluded observation
    - eventAt -> lastSeenAt -> presenceExpiresAt
  builder_freeform_boundary:
    - Local helper and test structure is builder-owned unless it changes source ownership, privacy, typed edge semantics, or proof.
```

### Change 1: Isolate native Codex eval runs

```text
fixes:
  - eval agents and judges currently create persisted sessions and ordinary hook telemetry
before:
  - optional profiles do not disable hooks, notify, or session persistence
after:
  - every native Codex harness invocation ends with --ephemeral --disable hooks -c notify=[]
read:
  - path: ../Farplane/skills/eval/scripts/run_evals.py
    reason: canonical eval runner
write:
  - path: ../Farplane/skills/eval/scripts/run_evals.py
    change: append mandatory isolation arguments after optional/user arguments
  - path: ../Farplane/skills/eval/tests/test_run_evals.py
    change: cover profile, no-profile, and adversarial override ordering
  - path: .farplane/evals/run_evals.py
    change: surgical generated-runner isolation sync only
operation:
  - preserve profiles and user config; do not add --ignore-user-config
signature_or_type_impact:
  - codex_extra_args returns an effective argument tail whose isolation flags win
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - focused Python eval-runner tests
  - semantic parity assertion that canonical and installed runners both end native Codex commands with the required isolation tail
failure_modes:
  - broad init overwrites local eval fixtures; custom shell template bypasses native runner
```

### Change 2: Publish complete hook lifecycle and typed subagent lineage

```text
fixes:
  - installed hooks omit native subagent lifecycle and discard classification metadata
before:
  - UserPromptSubmit/Stop publish generic codex rows; SubagentStart/Stop are absent
after:
  - all four lifecycle events publish sanitized identity, classification, and available title metadata
read:
  - path: ../Farplane/hooks.json
    reason: Core-owned installed hook configuration
  - path: ../Farplane/hooks/farplane_console_ping.py
    reason: canonical lifecycle publisher
write:
  - path: ../Farplane/hooks.json
    change: install SubagentStart/Stop handlers
  - path: ../Farplane/hooks/farplane_console_ping.py
    change: preserve agent_id/type, parent session, runtime kind/purpose, and available title
  - path: convex/modules/hookTelemetry/projections.ts
    change: normalize child identity and project spawned edges
operation:
  - use one raw hook telemetry table; never persist prompts, transcripts, or full tool output
  - SubagentStart creates one spawned edge; SubagentStop updates child lifecycle only and never creates a second edge or deletes the child graph node
signature_or_type_impact:
  - ThreadLineageEdge.kind gains spawned; stats gain spawnCount
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - Core hook tests plus Convex start+stop worker and single-edge lineage dedupe tests
failure_modes:
  - nested hooks lack direct parent thread; provisional parent is native session_id
```

### Change 3: Make hook presence honest and five-minute bounded

```text
fixes:
  - two hook sources compete, stale rows are extended, evals/subagents become employees, and titles are masked
before:
  - Convex replaces local; 15-minute now-based expiry; ephemeral workers promoted
after:
  - sources merge; five-minute lastSeenAt expiry; only root non-eval conversations enter roster
read:
  - path: ui/src/providers/office-data-provider.tsx
    reason: source merge owner
  - path: ui/src/providers/office-data-refresh.ts
    reason: roster and expiry owner
  - path: ui/src/providers/local-observed-codex-workers.ts
    reason: local event range owner
write:
  - path: ui/src/providers/office-data-provider.tsx
    change: merge and dedupe both hook sources
  - path: ui/src/providers/office-data-refresh.ts
    change: five-minute constant, root eligibility, observation-based expiry, and app-server thread-roster suppression while preserving PM/persistent roles
  - path: ui/src/providers/local-observed-codex-workers.ts
    change: use the shared five-minute query range
operation:
  - suppress ordinary codex-thread app-server agents from company/runtime/configured roster projections; preserve sidecar CEO/project-pulse/PM roles and all app-server control APIs
signature_or_type_impact:
  - observed worker classification carries runtime kind/purpose and ephemeral parentage
routes:
  docs: update_docs
  qa: visual-qa
  review: reviewer
qa:
  - provider tests for source merge, expiry, title priority, subagent/eval exclusion
  - browser proof with CODEX_APP_SERVER_URL unset
failure_modes:
  - old historical rows remain until their bounded range expires
```

### Change 4: Consume spawned lineage without creating employees

```text
fixes:
  - a backend spawned edge is invisible unless graph and office effect consumers accept its typed kind
before:
  - graph metrics and scene effects accept only created/forked cyan edges
after:
  - graph exposes spawnCount and spawned rows; office uses a violet transient projected endpoint with no roster employee
read:
  - path: ui/src/modules/team-workspace/components/thread-lineage-tab.tsx
    reason: operator graph consumer
  - path: ui/src/modules/office/scene/thread-lineage-effects.tsx
    reason: spatial transient effect consumer
write:
  - path: ui/src/modules/team-workspace/components/thread-lineage-tab.tsx
    change: accept spawned kind and display spawn metric/edge
  - path: ui/src/modules/office/scene/thread-lineage-effects.tsx
    change: render spawned edges violet while created/forked remain cyan
  - path: ui/src/modules/chat/thread-lineage.ts
    change: nest spawned child references with an honest fallback label
operation:
  - reuse the existing missing-child projection seam; do not materialize a subagent employee or persist an office object
signature_or_type_impact:
  - UI lineage unions gain spawned and graph stats gain spawnCount
routes:
  docs: update_docs
  qa: visual-qa
  review: reviewer
qa:
  - graph type/metric tests, office freshness/projection tests, and browser fixture
failure_modes:
  - spawned child becomes a durable employee; color is the only semantic cue; historical edges replay as fresh
```

## Done

```text
done_when:
  - office renders a hook-observed root conversation without CODEX_APP_SERVER_URL
  - root presence expires at lastSeenAt plus five minutes
  - native subagent lifecycle creates a spawned graph edge but no durable employee or desk
  - eval runtime rows are excluded and future native eval runs emit no hook/session residue
  - available threadTitle/title wins over generic agentName=codex
  - created, forked, and spawned remain distinct lineage kinds
  - focused tests, typechecks, hook install/list proof, browser QA, and material review pass
```

## QA Strategy

```text
qa_strategy:
  proof_weight: visual_qa
  checks:
    - focused Core eval and hook tests
    - focused Convex hook telemetry tests
    - focused provider, local-observation, chat-lineage, and office-lineage tests
    - root and UI typechecks scoped to touched workspaces
    - deterministic fake-clock assertion: visible before lastSeenAt+300000 and absent at/after the boundary
    - installed/canonical eval isolation-tail parity assertion
  manual:
    - install/list Core-owned hooks and inspect SubagentStart/Stop commands
    - run /office without CODEX_APP_SERVER_URL against root + subagent + eval fixtures
    - native eval smoke compares pre/post ~/.codex session ids and hook-event counts and records zero new residue
  delegated_lanes:
    - independent implementation review
    - browser visual QA
  review:
    - rubric: implementation, architecture, evidence-quality
      required_tas: TAS-A
  evidence:
    - tickets/TASK-0054/artifacts/hooks-list.json: installed SubagentStart/Stop command inventory linked to Core source
    - tickets/TASK-0054/artifacts/eval-isolation-smoke.json: command plus pre/post session and hook-event counts
    - tickets/TASK-0054/artifacts/presence-window-test.txt: deterministic five-minute boundary output
    - tickets/TASK-0054/artifacts/qa/2026-07-15_175628-hook-office/: app-server-disconnected titled root, zero eval/subagent employees, violet spawned projection, exact expiry, and validated PASS receipt
    - tickets/TASK-0054/artifacts/reviews/: implementation and completion receipts
  goal_advisor_inputs:
    proof_route: producer tests -> projection tests -> provider tests -> hook install smoke -> browser lifecycle
    final_evidence: one titled root employee, spawned lineage only, no eval/subagent employee
    final_checkpoint: reviewer confirms hook-canonical ownership and no privacy regression
  residual_risk:
    - Codex exposes no rename hook, so titles changed outside Farplane remain best-effort
    - Subagent hooks expose root session plus child agent id, not full nested direct-parent lineage
```

Grounding evidence: installed Codex 0.142.5 and exact official source tag,
current Core hook installer/publisher, persisted eval artifacts, Convex projection,
office provider, FEAT-0115, and office QA cookbook.

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - convex/modules/hookTelemetry/README.md
    - docs/features/FEAT-0115-office-kits-presence-and-camera.md
    - docs/HISTORY.md
    - docs/MEMORY.md
  no_docs_reason:
  validation:
    - docs describe hooks as roster/lineage owner and app-server as optional control path
```

## Agent Contract

- `Open:` `npm run ui`, then `/office` with `CODEX_APP_SERVER_URL` unset.
- `Test hook:` seed root, SubagentStart/Stop, and eval-purpose telemetry fixtures.
- `Stabilize:` use deterministic hook event timestamps inside the five-minute window.
- `Inspect:` employee QA state plus Thread Data lineage graph.
- `Key screens/states:` titled root active, spawned child transient/graph-only, eval hidden, root expired.
- `Design baseline:` no new layout; preserve current office and use typed semantic edge colors.
- `QA cookbook:` `qa/cookbook/office.md`.
- `Expected artifacts:` test logs, hook list JSON, screenshot, review receipt.

## Links

- `program:` none
- `progress:` none
- `visual companion:` `tickets/TASK-0054/diagrams.md`
- `artifacts:` `tickets/TASK-0054/artifacts/`
- `review:` `tickets/TASK-0054/artifacts/reviews/implementation-review.md` (TAS-A), `tickets/TASK-0054/artifacts/reviews/completion-review.md` (TAS-A), `tickets/TASK-0054/artifacts/qa/2026-07-15_175628-hook-office/result.json` (PASS)
- `refs:` `tickets/TASK-0003/ticket.md`, `tickets/TASK-0008/ticket.md`, `docs/features/FEAT-0115-office-kits-presence-and-camera.md`

## Notes

- `Blast radius:` Core-managed hooks, eval runner, hook projection, office roster, lineage consumers.
- `Rollback:` disable new lifecycle hooks and restore the prior projection window; no schema migration is required.
- `Minimal implementation:` reuses the existing raw hook log, projection functions, provider merge, and lineage graph.
- `Plan QA:` minimality pass; reuse pass; least parameters pass; architecture signatures pass; proof route pass; plan reviewer TAS-A.
- `Implementation proof:` 75 focused UI tests and 43 Core hook/eval tests pass; root and Convex typechecks pass; both worktrees pass `git diff --check`.
- `Browser proof:` hook-only `/office` reports app-server `configured=false`, renders one titled root and zero subagent/eval employees, exposes read-only control, resolves spawned violet `#c084fc/#e9d5ff`, and expires the root at `lastSeenAt + 300000`.
- `Completion:` independent final review reconciled every Done/Proof obligation at TAS-A with no blocker.
