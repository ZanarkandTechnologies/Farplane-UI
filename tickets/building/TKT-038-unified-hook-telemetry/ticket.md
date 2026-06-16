# TKT-038: Unified Hook Telemetry Foundation

## Status

- state: `building`
- owner: Kenji
- assignee:
- dependencies: `TKT-010`, `TKT-012`, `TKT-025`, `TKT-035`
- location: `tickets/building/TKT-038-unified-hook-telemetry`
- enter when: Hook-originated runtime telemetry, skill invocation telemetry, status-style updates, and future file-change summaries need one raw ingestion primitive before more UI features build on top of them.
- leave when: Farplane has one canonical hook telemetry table, existing skill/runtime hook producers write through it, and old raw table patterns have a clear migration path toward removal rather than permanent compatibility.
- blockers:
- spawned follow-ups:
  - File-change observer and progress summary hook
  - Agent bubble moments projection
  - Legacy table removal/backfill cleanup
- complexity: `L`

## Description

Farplane currently stores hook-like signals across several raw tables and product concepts: runtime telemetry pings, skill invocation events, agent events, and agent status. This makes it unclear whether a UI bubble, notification, timeline row, analytics chart, or durable project history owns a given signal.

This ticket introduces one raw hook telemetry module shaped around Codex hook events. Product features such as skill invocation counts, runtime turn analytics, key-file progress notifications, and agent head bubbles should become derived projections over that raw hook log.

## Goal

Create the unified hook telemetry foundation before adding more hook-powered UI features. Keep the raw schema lean, hook-shaped, and stable enough for `PostToolUse`, `Stop`, file observers, future Codex hook types, and imported historical rows.

## Schema Decision

Canonical raw table:

```ts
hookTelemetryEvents: defineTable({
  hookName: v.string(),
  hookType: v.string(),

  projectId: v.optional(v.string()),
  sessionId: v.optional(v.string()),

  payload: v.optional(v.any()),

  eventAt: v.number(),
  eventKey: v.optional(v.string()),
})
  .index("by_eventAt", ["eventAt"])
  .index("by_hook_eventAt", ["hookName", "eventAt"])
  .index("by_project_eventAt", ["projectId", "eventAt"])
  .index("by_session_eventAt", ["sessionId", "eventAt"])
  .index("by_eventKey", ["eventKey"]);
```

### Field Rules

- `hookName`: Farplane-maintained hook producer name, such as `skill-invocation-listener`, `codex-runtime-telemetry`, `codex-file-observer`.
- `hookType`: exact hook lifecycle name from the producer, such as `PostToolUse`, `Stop`, `UserPromptSubmit`, `SessionStart`, `PreCompact`, `PostCompact`, `SubagentStart`, `SubagentStop`, `FileChanged`.
- `projectId`: promoted because Farplane groups project/team operational views by project; do not add `teamId` here unless Farplane later separates teams from projects.
- `sessionId`: promoted because Codex hook payloads expose `session_id`; use this as the stable runtime/thread identity for later visual employee grouping.
- `payload`: hook-specific, sanitized, size-capped data. Keep `turnId`, `toolName`, `toolUseId`, `toolInput`, `toolResponse`, `filePath`, `skillId`, `cwd`, `summary`, and UI suggestions in payload.
- `eventAt`: the single timestamp. For live hooks this is now or the hook-provided time. For imports this is historical event time.
- `eventKey`: optional idempotency key for retry/import dedupe. The ingester should generate a stable fallback when a hook omits one.

Do not top-level `teamId`, `agentId`, `threadId`, `turnId`, `projectPath`, `source`, `receivedAt`, `toolName`, `filePath`, `visibility`, or `statusState` in the raw table.

### Hook Type Validation

Do not use a restrictive Convex enum for `hookType` in raw ingestion. Codex and Farplane hook names can expand, and unknown hook types should remain ingestible.

Use a TypeScript known-hook list next to the hook telemetry module for helper logic and tests:

```ts
export const KNOWN_CODEX_HOOK_TYPES = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PreCompact",
  "PostCompact",
  "SubagentStart",
  "SubagentStop",
  "Stop",
] as const;
```

Derived features may validate the subset they consume. Raw telemetry should not reject new hook names merely because the UI does not yet interpret them.

## Target Module Layout

Create:

```text
convex/modules/hookTelemetry/
  AGENTS.md
  README.md
  schema.ts
  validators.ts
  httpContracts.ts
  events.ts
  queries.ts
  projections.ts
  hookTelemetry.test.ts
```

Responsibilities:

- `schema.ts`: only raw `hookTelemetryEvents` table.
- `validators.ts`: envelope validators, payload caps, known hook type helpers, query args.
- `httpContracts.ts`: parse and sanitize HTTP payloads for `/telemetry/hooks`.
- `events.ts`: ingest mutation with event key dedupe.
- `queries.ts`: raw/debug queries plus derived windows needed by UI and dashboards.
- `projections.ts`: pure reducers that derive skill invocation rows, runtime turn rows, and future bubble moments from raw events.
- `README.md`: explain raw hook telemetry vs project history vs UI projections.

Keep hook-specific payload types beside the hook producers, not in the global telemetry module:

```text
hooks/skill-invocation-listener/
  handler.ts
  telemetry.ts        # SkillInvocationHookPayload + envelope builder
  handler.test.ts

hooks/file-observer/ # follow-up ticket
  telemetry.ts        # FileChangedHookPayload
```

## Directory-Level Refactor Shape

Current raw telemetry-related layout:

```text
convex/modules/
  agentActivity/
    schema.ts          # agentEvents + agentStatus raw/status tables
    events.ts          # status/event ingest and status reducer
    status.ts          # live status + activity feed queries
    contracts.ts
    httpContracts.ts

  runtimeTelemetry/
    schema.ts          # runtimeTelemetryActivityPings raw lifecycle table
    telemetry.ts       # ingest + dashboard queries
    runtimeTelemetry.ts# turn/agent-hour reducers
    validators.ts

  skillInvocations/
    schema.ts          # skillInvocationEvents raw skill table
    events.ts          # skill ingest
    queries.ts         # dashboard query
    contracts.ts
    httpContracts.ts
    validators.ts
```

Target layout after this ticket's migration foundation and cleanup:

```text
convex/modules/
  hookTelemetry/
    schema.ts          # canonical raw hookTelemetryEvents table
    events.ts          # generic hook ingest + dedupe
    queries.ts         # raw windows + derived query entrypoints
    projections.ts     # pure reducers for skill/runtime/bubble projections
    httpContracts.ts   # /telemetry/hooks payload parser/sanitizer
    validators.ts      # envelope validators + known hook helper list
    hookTelemetry.test.ts
    README.md
    AGENTS.md

  skillInvocations/
    contracts.ts       # keep only skill-specific projection contracts
    queries.ts         # skill-specific derived query over hookTelemetry projection
    skillInvocations.test.ts
    README.md
    AGENTS.md
    # schema.ts/events.ts/httpContracts.ts are temporary migration files only

  runtimeTelemetry/
    runtimeTelemetry.ts# keep deterministic runtime reducers
    telemetry.ts       # runtime dashboard query over hookTelemetry projection
    validators.ts      # query args only after raw table migration
    runtimeTelemetry.test.ts
    README.md
    AGENTS.md
    # schema.ts raw table is temporary migration storage only

  agentActivity/
    contracts.ts       # optional compatibility reducers only
    status.ts          # compatibility live-status reads until bubble moments land
    README.md
    AGENTS.md
    # schema.ts/events.ts/httpContracts.ts should not receive new hook features
```

Hook producer layout before:

```text
hooks/
  skill-invocation-listener/
    handler.ts         # parse hook payload + publish skill invocation
    run.ts
    handler.test.ts
    HOOK.md
```

Hook producer layout after:

```text
hooks/
  skill-invocation-listener/
    telemetry.ts       # SkillInvocationHookPayload + hook envelope builder
    handler.ts         # parse SKILL.md reads and emit hook telemetry envelope
    run.ts             # posts to /telemetry/hooks
    handler.test.ts
    HOOK.md

  file-observer/       # follow-up ticket, not implemented here
    telemetry.ts       # FileChangedHookPayload + hook envelope builder
    handler.ts
    run.ts
    handler.test.ts
    HOOK.md
```

UI-facing projection layout after the foundation:

```text
ui/src/modules/
  skill-invocations/
    skill-invocations-panel.tsx
    # reads derived skill invocation query from hook telemetry

  office/
    components/employee/StatusBubbles.tsx
    intent/resolve-agent-intent.ts
    # later consumes agent bubble / current skill projections

  telemetry/
    components/
      telemetry-dashboard-views.tsx
      telemetry-dashboard-recharts.tsx
    # runtime charts read derived runtime telemetry projection
```

Module ownership rule:

```text
hookTelemetry owns raw hook storage.
skillInvocations owns skill-specific interpretation.
runtimeTelemetry owns runtime/agent-hour interpretation.
office owns bubble and movement interpretation.
Project files own durable history and memory.
```

## Files Expected To Change

### Convex

- `convex/schema.ts`
  - include `hookTelemetryTables`.
- `convex/http.ts`
  - add `/telemetry/hooks` and `/telemetry/hooks/batch`.
  - keep old endpoints during migration.
- `convex/modules/hookTelemetry/*`
  - new module.
- `convex/modules/skillInvocations/*`
  - switch dashboard/query path to derived hook telemetry rows.
  - keep old raw files only long enough to run/backstop migration.
- `convex/modules/runtimeTelemetry/*`
  - switch dashboard/query path to derived hook telemetry rows.
  - keep old raw table only long enough to run/backstop migration.
- `convex/modules/agentActivity/*`
  - do not expand this module for new hook features.
  - mark future role as projection/compat only if still needed.

### Hooks

- `hooks/skill-invocation-listener/handler.ts`
  - write hook telemetry envelope.
  - preserve old write in phase 1 if needed.
- `hooks/skill-invocation-listener/run.ts`
  - route to new hook telemetry endpoint.
- `hooks/skill-invocation-listener/HOOK.md`
  - document new raw telemetry write.
- `hooks/skill-invocation-listener/telemetry.ts`
  - new payload/envelope helper co-located with producer.
- `scripts/install-skill-invocation-hook.mjs`
  - update docs/config only if endpoint assumptions are embedded.
- `scripts/import-aikage-telemetry.mjs`
  - later phase: emit `hookTelemetryEvents` for historical `UserPromptSubmit`/`Stop`-style lifecycle rows.

### UI

- `ui/src/modules/skill-invocations/skill-invocations-panel.tsx`
  - read derived skill invocation query over hook telemetry.
- `ui/src/modules/skills-studio/components/skill-os/use-skill-invocation-counts.ts`
  - read derived hook telemetry query.
- `ui/src/modules/office/components/employee/StatusBubbles.tsx`
  - no direct raw telemetry coupling; future bubble projection feeds this.
- `ui/src/modules/office/intent/resolve-agent-intent.ts`
  - later phase: current skill id should be derived from hook telemetry projections.
- `ui/src/hooks/use-agent-live-status.ts`
  - avoid adding more status/event concepts; keep compatibility only.

### Docs / Tests

- `docs/MEMORY.md`
  - record decision: one raw hook telemetry table, product projections above it.
- `docs/how-to/convex-status-hook-setup.md`
  - revise once status is no longer the primary hook/event model.
- `docs/public-docs/feature-teams-heartbeats.md`
  - revise heartbeat visibility language after projections exist.
- `tickets/INDEX.md`
  - add this ticket.

## Proposed Migration Phases

### Phase 1: Raw Hook Telemetry Module

- Add `hookTelemetryEvents` schema and module.
- Add HTTP ingest endpoints:
  - `POST /telemetry/hooks`
  - `POST /telemetry/hooks/batch`
- Sanitize payloads:
  - reject non-object payloads except `undefined`
  - cap payload JSON size
  - strip or truncate giant text fields such as tool outputs
  - normalize `session_id` to `sessionId` in the envelope where available
- Add event key dedupe:
  - use provided `eventKey`
  - otherwise generate a best-effort key from `hookName`, `hookType`, `sessionId`, `payload.turnId`, `payload.toolUseId`, and `eventAt` bucket.

### Phase 2: Skill Invocation Producer Migration

- Move skill invocation writes to `hookTelemetryEvents`.
- Define `SkillInvocationHookPayload` beside the hook.
- Add derived skill invocation dashboard query over hook telemetry.
- Do not keep a permanent dual-write. Use old `skillInvocationEvents` only as a temporary backfill source while migrating existing data.

### Phase 3: Runtime Telemetry Compatibility

- Add derived runtime telemetry projections from hook telemetry.
- Move runtime dashboard reads to hook telemetry projections.
- Add a backfill mutation/script path from `runtimeTelemetryActivityPings` into `hookTelemetryEvents`.
- Do not keep a permanent runtime raw table once migration is complete.

### Phase 4: Bubble / Notification Projection

- Add derived `agentBubbleMoments` query over hook telemetry.
- Bubble policy lives in the office/agent bubble module, not in raw telemetry.
- Priority:
  - fresh status/file/skill moment displays for about 5 seconds
  - sticky notifications display when no transient moment is active
  - multiple sessions equipped to one visual employee rotate or stack compactly.

### Phase 5: Cleanup

- Remove old raw tables after consumers move and deployed data is backfilled.
- Update docs so product language says "hook telemetry" and "bubble moments," not "status vs events."

## Acceptance Criteria

- [x] AC-1: `hookTelemetryEvents` exists as the canonical raw hook log with the agreed lean schema and indexes.
- [x] AC-2: `/telemetry/hooks` and `/telemetry/hooks/batch` ingest sanitized hook envelopes with optional event-key dedupe.
- [x] AC-3: Skill invocation listener writes to unified hook telemetry and existing skill invocation UI can read from a derived query.
- [x] AC-4: Runtime telemetry reducers have a documented migration path toward hook telemetry without breaking the current dashboard query path.
- [x] AC-5: No new feature-specific raw table is introduced for file-change summaries or agent bubbles in this ticket.
- [x] AC-6: Docs explain the three-layer model: local project history, raw hook telemetry, and derived UI projections.

## Agent Contract

- Open: Start by reading this ticket, `convex/modules/runtimeTelemetry`, `convex/modules/skillInvocations`, `convex/modules/agentActivity`, `convex/http.ts`, and `hooks/skill-invocation-listener`.
- Test hook: Add focused Convex/module tests for ingest, dedupe, payload caps, and derived skill invocation projection.
- Stabilize: Dual-write or compatibility-adapt existing consumers before removing old reads.
- Inspect: Confirm UI panels still render skill invocation counts and no office status path regresses.
- Key screens/states: Skill invocation dashboard, Skill OS invocation counts, office employee bubble/skill intent path.
- Taste refs: Keep raw telemetry invisible to normal operators; expose only derived meaningful moments in the office.
- Expected artifacts: Updated module docs, tests, and this ticket.
- Delegate with: Use focused implementation agents for Convex schema/HTTP, hook producer migration, and UI query migration if splitting.

## Evidence Checklist

- [ ] Snapshot: Convex tests for `hookTelemetryEvents` ingest and projection.
- [ ] Snapshot: Skill invocation listener tests proving unified telemetry payload.
- [ ] Screenshot: Skill invocation dashboard still populated after query migration.
- [ ] QA report linked:

## Build Notes

- 2026-06-17: Implemented unified raw hook telemetry, backfilled deployed legacy skill/runtime rows, moved current ingest/query/import paths onto hook telemetry, and removed old raw table schemas/endpoints.
- This ticket intentionally does not implement the file-change summary hook. It prepares the raw telemetry lane that hook should use.
- Do not make `hookType` a restrictive Convex enum. Unknown hooks should be accepted and left to projections to interpret.
- Do not add `teamId` unless a real product split between project and team identity appears.
- Do not add `agentId` to raw Codex hook telemetry until a reliable producer can supply it.
- Prefer deleting old conceptual language over wrapping it with more aliases.

## QA Reconciliation

- AC-1: `PASS | FAIL | NOT PROVABLE`
- AC-2: `PASS | FAIL | NOT PROVABLE`
- AC-3: `PASS | FAIL | NOT PROVABLE`
- AC-4: `PASS | FAIL | NOT PROVABLE`
- AC-5: `PASS | FAIL | NOT PROVABLE`
- AC-6: `PASS | FAIL | NOT PROVABLE`
- Screen: `PASS | FAIL | NOT PROVABLE`
- Evidence item: `CAPTURED | MISSING`

## Artifact Links

## User Evidence

- Hero screenshot:
- Supporting evidence:
- QA report:
- Final verdict:

## Required Evidence

- [ ] Unit/integration/e2e tests pass (as applicable)
- [ ] Typecheck passes
- [ ] Lint passes
