---
template_id: ticket-template
template_version: "0.1.3"
feature_refs:
  - FEAT-0112
  - FEAT-0114
ticket_id: TASK-0070
title: Purge Convex teamBoard after filesystem Kanban migration
phase: proof
status: done
owner: codex
priority: high
depends_on: []
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-07-24T20:48:00+08:00
updated_at: 2026-07-24T13:54:50.257222Z
next_action: save the final evidence-quality receipt, then run the canonical close/archive command
last_verification: 2026-07-24T21:53:00+08:00 browser, visual, drift, build, and completion review gates pass
---
# TASK-0070: Purge Convex teamBoard after filesystem Kanban migration

## Summary

Finish the already-started migration from Convex `teamBoard` state to the
filesystem-backed project ticket/Kanban provider. Make filesystem tickets the
only canonical task and review workflow, migrate every remaining reader and
writer, export and verify any live legacy rows, then delete the Convex
teamBoard schema, functions, compatibility entrypoints, generated API, and
stale doctrine without a fallback or shim.

## Scope

- In:
  - Treat the existing filesystem project Kanban path as canonical.
  - Migrate Team Workspace, CEO surfaces, CLI, HTTP routes, agent activity, and
    tests away from `api.board` and `teamBoardTasks`/`teamBoardEvents`.
  - Preserve the filesystem ticket lifecycle, review lane, task memory,
    ownership, priority, and user-visible agent activity without recreating
    Convex task state.
  - Keep Team Workspace and CEO views honest and read-only. Put retained task
    writes in one shared filesystem ticket owner used by the CLI; UI refreshes
    the resulting canonical files.
  - Export, count, and verify any configured live legacy rows before deletion;
    record an honest no-deployment/source-gap receipt when no live target is
    configured.
  - Remove compatibility entrypoints, Convex modules/tables/functions, HTTP
    contracts, generated API references, CLI commands or rename them to the
    canonical filesystem ticket vocabulary where retained.
  - Rewrite active docs, feature specs, architecture, memory decisions,
    history, QA, and tests to match the filesystem-only contract.
- Out:
  - A new task database or generic provider abstraction.
  - Preserving `teamBoard`, `api.board`, or dual-read compatibility.
  - Deleting unrelated Convex domains such as activity, artefacts, telemetry,
    or runtime presence.
  - Adding proof-bypassing UI close/delete actions or a second ticket schema.
  - Deploying unrelated product changes.
  - Inventing a second filesystem ticket format.

## Delta

```text
overall_before:
  - Team Workspace already prefers filesystem project Kanban rows when ready.
  - Legacy Convex board queries, mutations, tables, HTTP routes, CLI commands, CEO readers, activity joins, docs, and memories still claim canonical ownership.
overall_after:
  - Filesystem project tickets are the sole task, review, and task-memory source.
  - Team Workspace and CEO task surfaces read filesystem projections only;
    retained CLI task writes use one filesystem ticket owner.
  - Convex teamBoard code, schema, generated API, compatibility aliases, and stale doctrine are gone.
why_now:
  - The UI migration already established the successor; retaining the fallback creates contradictory ownership and ongoing maintenance.
problems:
  - before: useProjectKanban wins only when ready, then useTeamPanelBoardState silently falls back to Convex.
    after: one filesystem path owns reads and writes with honest source-gap behavior.
    why_now: fallback behavior hides migration gaps and keeps obsolete infrastructure live.
  - before: CLI and CEO surfaces still write/read api.board directly.
    after: retained CLI workflows use filesystem-ticket commands; unsafe board-only bot, delete, and close shortcuts are removed.
    why_now: canonical state must not split across two task stores.
  - before: durable docs and memory declare Convex team boards canonical.
    after: active doctrine states filesystem tickets are canonical and history records the completed migration.
    why_now: future agents otherwise recreate or depend on the deleted path.
first_principles_basis:
  objective: leave one inspectable, local-first task truth throughout Farplane UI
  need: remove contradictory state ownership after the filesystem Kanban path became primary
  assumptions:
    - project tickets already cover the active Team Workspace Kanban lifecycle
    - missing mutation capabilities can extend existing ticket/provider owners without adding a new store
    - configured live Convex data can be exported before table/function removal
  root_cause: the filesystem migration added provider precedence but never completed consumer, mutation, schema, or doctrine removal
  constraints:
    - no dual path or compatibility shim
    - live data must be exported and reconciled before disposal
    - unrelated dirty-worktree edits must be preserved
    - browser-visible workflows need delegated proof
  first_viable_slice: complete migration of every current caller, then delete the legacy domain in the same ticket
  proof_or_falsification: reject completion if any active api.board/teamBoard reference remains, any user workflow loses required state, or legacy rows are deleted without an export/source-gap receipt
  tradeoff: accept local projection refresh instead of Convex realtime board updates
  non_goals:
    - generic task-provider architecture
    - new board concepts
    - retaining old command names
```

## Change Plan

### Change 0: Freeze the dirty-worktree ownership boundary

```text
fixes:
  - this migration overlaps a large pre-existing dirty worktree
before:
  - unrelated edits and TASK-0070 edits are distinguishable only from transient git state
after:
  - a pre-edit receipt records overlapping paths and content hashes; every later diff is checked against that baseline
read:
  - path: git status and git diff for the repository
    reason: identify user-owned edits before touching shared files
write:
  - path: tickets/TASK-0070/artifacts/validation/pre-edit-worktree.md
    change: record pre-existing overlap, hashes, exclusions, and preservation rules
operation:
  - baseline_worktree(overlap_paths) -> ownership receipt
signature_or_type_impact:
  - none
routes:
  docs: no_docs
  qa: tests
  review: reviewer
qa:
  - pre-completion diff review confirms unrelated resource-bank, finance, office, highlight, and other ticket changes remain intact
failure_modes:
  - a shared-file edit replaces rather than composes with a pre-existing change
```

### Change 1: Make filesystem tickets the complete read model

```text
fixes:
  - canonical ticket_id, claimed_by, review status, Markdown memory, and multi-project rows are incompletely projected today
before:
  - the single-project bridge reads tracked ticket.md files through a lossy partial frontmatter shape
  - CEO reads api.board and substitutes demo rows when the remote board is empty
after:
  - one filesystem projection returns stable TASK-* identity, canonical owner/status/priority, raw Markdown, and project scope
  - CEO consumes the existing multi-project read model and renders an honest empty/source-gap state
read:
  - path: ui/vite.config.ts
    reason: existing project ticket scanner and project read-model bridge
  - path: ui/src/modules/runtime/lib/codex-app-server/
    reason: existing multi-project company/task projection
  - path: ui/src/modules/review-board/
    reason: CEO task normalization and demo fallback
write:
  - path: ui/vite.config.ts
    change: tighten canonical ticket parsing and projection without a second schema
  - path: ui/src/modules/runtime/lib/codex-app-server/
    change: carry the filesystem fields already needed by CEO/task memory
  - path: ui/src/modules/review-board/
    change: normalize filesystem rows and remove mock-as-health behavior
operation:
  - read_project_tickets(project_path) -> canonical task rows
  - aggregate_project_tickets(projects[]) -> CEO task rows
signature_or_type_impact:
  - PanelTask gains no duplicate identity; task id is canonical ticket_id and project scope stays contextual
routes:
  docs: doc-advisor
  qa: tests
  review: reviewer
qa:
  - temporary projects prove canonical IDs, status/owner mapping, Markdown preservation, archive exclusion, and honest empty state
failure_modes:
  - richer YAML is misread, the 200-file cap hides tickets, or mock tasks mask a source gap
```

### Change 2: Replace the CLI board family with filesystem ticket operations

```text
fixes:
  - team board task and memory commands still read/write Convex even though filesystem tickets are canonical
before:
  - team-board.ts sends task lifecycle, memory, bot-next, and timeline commands to /board/*
after:
  - a shared filesystem ticket store owns safe create, list, update, status, claim, priority, and Notes-memory operations
  - the CLI exposes ticket vocabulary and removes board-only bot selection plus proof-bypassing delete/close shortcuts
read:
  - path: cli/team-commands/team-board.ts
    reason: legacy command behavior and tests
  - path: tickets/templates/ticket.md
    reason: canonical ticket shape
  - path: cli/team-commands/_shared.ts
    reason: project resolution and permissions
write:
  - path: cli/project-ticket-store.ts
    change: add the sole YAML-aware filesystem mutation owner
  - path: cli/team-commands/team-ticket.ts
    change: register retained task and memory commands using canonical ticket terminology
  - path: cli/team-commands/index.ts
    change: register ticket commands, route root status directly to agent activity, and drop the board registrar
  - path: cli/team-commands/team-business.ts
    change: replace optional board seeding with canonical ticket creation and keep business activity on agentEvents
  - path: cli/team-commands/team-config.ts
    change: read monitor timeline from the status/activity route instead of board query
  - path: cli/team-commands/team-heartbeat.ts
    change: render task counts from filesystem tickets resolved through project.trackingContext
  - path: templates/workspace/HEARTBEAT-biz-pm.md
    change: replace board commands with filesystem ticket and direct status commands
  - path: cli/team-commands.test.ts
    change: replace HTTP board fixtures with temporary-project filesystem proof
operation:
  - mutate_ticket(project_path, ticket_id, patch, expected_mtime?) -> updated ticket + receipt
  - create_ticket(project_path, title, fields) -> TASK-* ticket.md + receipt
signature_or_type_impact:
  - no persisted composite id; project path plus ticket_id is the natural lookup key
  - derived project identity and artifact path remain projection-only fields
routes:
  docs: doc-advisor
  qa: tests
  review: reviewer
qa:
  - create/update/status/claim/priority/memory/reload tests preserve unknown YAML fields and untouched Markdown sections
failure_modes:
  - concurrent allocation, path traversal, stale overwrite, or a casual done/delete bypasses the canonical close workflow
```

### Change 3: Remove board reads and writes from user-visible UI

```text
fixes:
  - Team Workspace and CEO still import api.board and retain dead mutation controls behind a read-only filesystem snapshot
before:
  - filesystem rows win only after readiness; Convex and company tasks remain fallbacks
  - CEO review buttons write an empty legacy production board
after:
  - Team Workspace reads only useProjectKanban rows and shows source errors honestly
  - agent communication reads the retained agentActivity/status domain
  - Team Workspace and CEO task details are explicitly read-only and point to canonical ticket memory
read:
  - path: ui/src/modules/team-workspace/components/
    reason: source precedence, Kanban controls, task detail, and activity
  - path: ui/src/components/hud/ceo-*.tsx
    reason: company task query and review mutation
write:
  - path: ui/src/modules/team-workspace/components/
    change: delete Convex board fallback/mutation plumbing and disable unsafe filesystem UI writes
  - path: ui/src/components/hud/ceo-workbench-panel.tsx
    change: consume filesystem company tasks
  - path: ui/src/components/hud/ceo-task-detail-modal.tsx
    change: remove board mutation and present canonical read-only review memory
operation:
  - useProjectKanban(project_path) -> filesystem task rows + explicit load/error state
  - useAgentActivity(team_id) -> agentEvents-only communication rows
signature_or_type_impact:
  - boardActionState and onBoardCommand leave Kanban/task-detail props
routes:
  docs: doc-advisor
  qa: qa-tester | visual-qa
  review: reviewer
qa:
  - browser proves filesystem cards, detail memory, review lane, CEO aggregation, refresh, and zero /board or api.board requests
failure_modes:
  - fallback data conceals an unreadable project or removing controls leaves misleading editable affordances
```

### Change 4: Separate agent activity from deleted task events

```text
fixes:
  - agent feeds and summaries join teamBoardEvents even though agentEvents already own status/activity
before:
  - board activity_log proxies event ingestion and /board/query proxies timeline reads
  - status summaries derive task done/blocked counts from board events
after:
  - CLI activity writes use the existing /ingest or /status/report contract directly
  - one status-owned HTTP read route serves retained timeline callers
  - agent feeds and summaries are agentEvents-only and no longer imply task lifecycle counts
read:
  - path: convex/modules/agentActivity/
    reason: retained event/status owner
  - path: convex/http.ts
    reason: current status, ingest, and board proxy routes
  - path: cli/team-commands/_convex.ts
    reason: current transports
write:
  - path: convex/modules/agentActivity/status.ts
    change: remove board joins and board-derived summary fields
  - path: convex/http.ts
    change: retain authenticated status/activity endpoints and delete board proxies
  - path: cli/team-commands/_convex.ts
    change: route root status, business/resource/fund/agent activity directly and read ticket counts from filesystem
  - path: cli/agent-commands.ts
    change: retain coordination activity through direct agent-event ingestion
  - path: cli/team-commands/team-business.ts
    change: retain business breadcrumbs through direct agent-event ingestion
  - path: cli/team-commands/team-resources.ts
    change: retain resource breadcrumbs through direct agent-event ingestion
  - path: cli/team-commands/team-funds.ts
    change: retain funds breadcrumbs through direct agent-event ingestion
  - path: cli/team-commands/team-config.ts
    change: consume the status-owned team timeline route
operation:
  - report_agent_activity(event) -> agentEvents
  - read_team_activity(team_id, project_id?) -> agentEvents[]
signature_or_type_impact:
  - ActivityFeedEvent source narrows to agent_event
  - task done/blocked summary counts are removed instead of silently zeroed
routes:
  docs: doc-advisor
  qa: tests
  review: reviewer
qa:
  - focused status contract/function tests prove feeds, summaries, dedupe, and project filtering without teamBoardEvents
failure_modes:
  - weaker auth, lost status breadcrumbs, or stale consumers expecting board-derived counts
```

### Change 5: Export evidence, then delete the Convex domain atomically

```text
fixes:
  - schema, routes, compatibility files, generated API, permissions, and tests keep the obsolete store deployable
before:
  - teamBoardTasks/teamBoardEvents and api.board remain active code despite an empty production deployment
after:
  - exact reachable-target receipts exist; the legacy module/tables/routes/contracts/permissions/generated exports are absent
read:
  - path: convex/modules/teamBoard/
    reason: deletion boundary
  - path: convex/schema.ts
    reason: table composition
  - path: convex/_generated/
    reason: generated public surface
write:
  - path: tickets/TASK-0070/artifacts/migration/
    change: production-empty and development-auth source-gap receipts
  - path: convex/
    change: remove teamBoard module, compatibility files, schema spread, routes, contracts, and tests; regenerate API
operation:
  - resolve_target -> export/count/reconcile or honest source_gap
  - remove_team_board() -> no schema, function, route, permission, or generated API residue
signature_or_type_impact:
  - api.board and teamBoard table types cease to exist
routes:
  docs: doc-advisor
  qa: tests
  review: reviewer
qa:
  - production data listing proves no tables; development 401 is recorded without mutation
  - Convex codegen/typecheck and forbidden-reference scan pass
failure_modes:
  - deleting an unresolved non-empty target, hand-editing generated types, or clearing unrelated tables
```

### Change 6: Replace active doctrine and prove the full lifecycle

```text
fixes:
  - active architecture, skills, templates, memories, and tests still direct agents to team board
before:
  - durable guidance contradicts filesystem ownership and can recreate the deleted path
after:
  - active guidance names filesystem tickets for tasks and agentEvents for status; history preserves the old event and records the migration
read:
  - path: docs, skills, templates, scripts, README.md, ARCHITECTURE.md, PROJECT_RULES.md
    reason: active reference inventory
write:
  - path: ARCHITECTURE.md, PROJECT_RULES.md, README.md, cli/README.md, convex/README.md
    change: replace Convex task ownership with filesystem tickets and agentEvents
  - path: docs/features/FEAT-0112-board-native-task-planning-review.md, docs/features/FEAT-0111-affiliate-marketing-mvp.md, docs/features/FEAT-0114-dashboard-projection-architecture.md
    change: replace the old task API and ownership contract
  - path: docs/public-docs/architecture.md, docs/prd.md, docs/specs/SC12-spec-skill-orchestration-and-workflow-wizard.md
    change: remove current-tense board commands and storage claims
  - path: docs/how-to/ceo-team-cli-scl-cookbook.md, docs/references/autonomous-business-mvp-decisions.md, docs/references/openclaw-adapter-contracts.md
    change: replace operational legacy instructions
  - path: skills/farplane-kanban-ops/SKILL.md, skills/farplane-team-cli/SKILL.md, skills/create-team/SKILL.md
    change: use filesystem ticket commands and direct status/activity
  - path: skills/measure/product-researcher/SKILL.md, skills/distribute/instagram-poster/SKILL.md, skills/distribute/tiktok-poster/SKILL.md
    change: remove team board task/status instructions
  - path: skills/create-team/tests/team-proposal-lifecycle.md
    change: update the executable example
  - path: templates/workspace/HEARTBEAT-biz-pm.md
    change: use ticket/status commands
  - path: scripts/reset-demo-office.sh
    change: remove board token, skip-board, and remote seeding behavior
  - path: docs/MEMORY.md
    change: supersede active Convex-canonical decisions with filesystem-ticket ownership
  - path: docs/HISTORY.md
    change: append one migration completion event
operation:
  - scan_active_refs(allowlist) -> zero obsolete runtime/doctrine matches
  - allowlist -> docs/HISTORY.md + tickets/archive/** + TASK-0070 packet/migration receipts only
signature_or_type_impact:
  - none
routes:
  docs: doc-advisor
  qa: qa-tester | visual-qa
  review: reviewer
qa:
  - focused/full checks, active-reference scan for api.board|teamBoard|team board|/board/*|team.board.write|FARPLANE_BOARD_OPERATOR_TOKEN, browser/network proof, evidence review, visual QA, drift review, and TAS-A completion review
failure_modes:
  - broad allowlists hide active references or historical evidence is rewritten
```

## Gap Analysis

- `Current state:` filesystem project Kanban already has read precedence in
  Team Workspace, but legacy Convex and CLI/CEO/activity surfaces remain.
- `Production expectation:` one canonical task store, one mutation path,
  explicit migration receipts, no dead compatibility API, and durable docs
  matching runtime ownership.
- `Missing gaps:` caller inventory, capability parity, live-row disposition,
  mutation routing, activity replacement, generated API cleanup, and end-to-end
  browser proof.
- `Comparable implementations:` local project-ticket/Kanban and Core projection
  patterns are the controlling implementation; no external storage design is
  required.
- `Recommendation:` complete the local migration and purge in one ticket so no
  dual-state intermediate contract is accepted as done.

## Done

```text
done_when:
  - Filesystem project tickets are the only canonical task/review/task-memory state.
  - Team Workspace and CEO task/review surfaces work without Convex board queries or mutations.
  - Retained CLI task workflows operate on filesystem tickets without team board vocabulary.
  - Agent activity and timeline behavior no longer query teamBoardEvents.
  - Any configured live legacy rows have an export, count reconciliation, and disposal receipt; absent live configuration is recorded honestly.
  - api.board, teamBoardTasks, teamBoardEvents, the module, schema spread, HTTP routes/contracts, compatibility entrypoints, generated API rows, docs, and tests are removed.
  - Repository-wide active-source search finds no teamBoard/api.board references outside archived history/migration evidence explicitly allowed by the ticket.
  - Focused and full relevant tests, builds/typechecks, browser QA, evidence review, visual QA where UI changed, drift review, and completion review pass.
  - Complete-phase validation is attempted; if this repo lacks its validator
    rules source, the gap and substitute proof are recorded before canonical
    close/archive.
```

## QA Strategy

```text
qa_strategy:
  proof_weight: visual_qa
  checks:
    - capability parity matrix before deletion
    - filesystem ticket read/create/update/status/claim/priority/memory tests
    - repository-wide forbidden-reference search
    - Convex schema/API generation and remaining-domain tests
    - CLI focused tests and build/typecheck
    - Team Workspace and CEO focused tests
    - live export/disposal or source-gap receipt validation
  manual:
    - create or select a filesystem ticket through the CLI, move it into review, edit task memory, reload, and confirm the same state in retained read-only UI surfaces
    - confirm no board surface requests Convex board endpoints
  delegated_lanes:
    - qa-tester captures the real filesystem task lifecycle, screenshots, network/console errors, and reload behavior
    - visual-qa judges changed task/review surfaces against the existing design
    - reviewer judges migration safety, deletion completeness, evidence sufficiency, and final readiness
    - goal-drift-reviewer checks the packet before destructive deletion and completion
  review:
    - rubric: implementation-plan
      required_tas: TAS-A
    - rubric: architecture
      required_tas: TAS-A
    - rubric: evidence-quality
      required_tas: TAS-A
    - rubric: integration-readiness
      required_tas: TAS-A
    - rubric: ui-quality
      required_tas: TAS-A
    - rubric: frontend-code-maintainability
      required_tas: TAS-A
  evidence:
    - tickets/TASK-0070/artifacts/migration/
    - tickets/TASK-0070/artifacts/qa/
    - tickets/TASK-0070/artifacts/visual-qa/
    - tickets/TASK-0070/artifacts/review/
    - tickets/TASK-0070/artifacts/validation/
  goal_advisor_inputs:
    proof_route: capability inventory -> export/reconciliation -> focused migration tests -> forbidden-reference scan -> browser QA -> evidence review -> visual QA -> completion review
    final_evidence: migration/export receipt, command receipts, best browser screenshot, network proof without board requests, and TAS-A review artifacts
    final_checkpoint: pre-delete drift check; QA evidence and completion reviews pass; complete-phase validation passes; then close TASK-0070
  residual_risk:
    - a configured live Convex deployment may contain legacy rows whose project mapping is incomplete
    - unrelated Convex domains may currently join board events and require a narrower replacement projection
```

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - ARCHITECTURE.md
    - docs/features/FEAT-0112-board-native-task-planning-review.md
    - docs/features/FEAT-0114-dashboard-projection-architecture.md
    - docs/MEMORY.md
    - docs/HISTORY.md
    - docs/public-docs/architecture.md
    - cli/README.md
    - ui/src/modules/team-workspace/README.md
    - convex/README.md
  no_docs_reason:
  validation:
    - active docs contain no obsolete canonical-teamBoard claim
    - feature/system registry and doc-reference checks pass
```

## Agent Contract

- `Open:` `corepack pnpm run ui`, open `/office`, then Team Workspace Work /
  Kanban and CEO review/task surfaces.
- `Test hook:` isolated filesystem project fixture with todo, review,
  in-progress, blocked, and done tickets plus task-memory content.
- `Stabilize:` use a temporary project root and explicit fixture; do not mutate
  unrelated real project tickets during QA.
- `Inspect:` filesystem ticket files, CLI mutation receipts,
  `/farplane/kanban/read`, rendered task state, network requests, console, and
  page errors.
- `Key screens/states:` Team Workspace Kanban; task detail/memory; review lane;
  CEO workbench/task detail; empty/source-gap state; reload persistence.
- `Design baseline:` existing Team Workspace and CEO task surfaces; layout
  redesign is not required.
- `QA cookbook:` `qa/README.md` plus the nearest Office/Team Workspace browser
  cookbook.
- `Expected artifacts:` migration matrix, legacy export/disposal receipt,
  focused command logs, forbidden-reference scan, screenshots, network log,
  visual QA, evidence review, and completion review.
- `Delegate with:` this ticket as `context_ref`; lanes must preserve unrelated
  dirty worktree changes.

## Run Hints

- `Likely size:` epic
- `Goal recommendation:` required
- `Budget hint:` one uninterrupted active Goal; no spend or deploy beyond the
  configured legacy-data export/disposal explicitly in scope
- `Compute hint:` local_shared
- `Planning hint:` impl_plan
- `QA source:` QA Strategy
- `Batchability:` single-ticket
- `Batch reason:` migration and deletion share one atomic ownership boundary
- `Human inputs/assets:` none; filesystem canonical ownership is operator-confirmed
- `Credentials / external access:` use configured Convex access only for
  export/reconciliation/disposal; never print secrets. Production is currently
  reachable and empty; development currently returns MissingAccessToken.
- `Compute/runtime needs:` local pnpm workspace, optional configured Convex target
- `Tooling gaps:` record honest source gap when no live Convex target is configured
- `QA risks:` stale network calls, capability loss, incomplete generated API cleanup
- `Human gates:` none beyond destructive target resolution and export verification
- `Agent decision boundaries:` preserve unrelated Convex domains and filesystem ticket schema

## Links

- `program:` `tickets/TASK-0070/program.md`
- `progress:` `tickets/TASK-0070/progress.md`
- `visual companion:` `tickets/TASK-0070/diagrams.md`
- `artifacts:` `tickets/TASK-0070/artifacts/`
- `migration receipt:` `tickets/TASK-0070/artifacts/migration/target-resolution.json`
- `implementation checks:` `tickets/TASK-0070/artifacts/validation/2026-07-24-implementation-checks.md`
- `browser QA:` `tickets/TASK-0070/artifacts/qa/browser/result.json`
- `visual QA:` `tickets/TASK-0070/artifacts/visual-qa/2026-07-24-visual-qa.md`
- `final drift:` `tickets/TASK-0070/artifacts/review/2026-07-24-final-drift.json`
- `completion review:` `tickets/TASK-0070/artifacts/review/2026-07-24-completion-review.json`
- `review:` `tickets/TASK-0070/artifacts/review/`
- `refs:`
  - `docs/features/FEAT-0112-board-native-task-planning-review.md`
  - `ui/src/modules/team-workspace/components/use-project-kanban.ts`
  - `ui/src/modules/team-workspace/components/use-team-panel-board.ts`
  - `convex/modules/teamBoard/`

## Notes

- Operator confirmation: filesystem project tickets/Kanban are already the
  intended canonical team-board implementation.
- This ticket treats the remaining Convex path as unfinished migration debt,
  not as a competing architecture option.
- Grounding evidence: local filesystem ticket, Vite bridge, CLI, Convex, and
  UI contracts plus official Convex export/import/schema/deployment docs.
- Minimal implementation claim: reuse the existing project Kanban/ticket
  owners, add only current capability gaps, and delete the obsolete domain.
