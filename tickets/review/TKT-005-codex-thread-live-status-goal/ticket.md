# TKT-005: Codex thread live status for employee loaders

## Status

- state: `review`
- owner: codex
- assignee:
- dependencies:
- location: `tickets/review/TKT-005-codex-thread-live-status-goal`
- enter when: Codex app-server threads are treated as employee agents but office loader state still lacks precise running-thread progress
- leave when: the UI can cheaply show running/idle/error state on employee heads from `thread/list`, and an opened chat panel can rejoin one thread for richer streaming progress
- blockers: full `npm run ui:typecheck` is blocked by unrelated existing UI type errors outside the TKT-005 files
- spawned follow-ups:
- complexity: `M`

## Description

Farplane UI now maps Codex app-server threads into office employees, but the employee loader state currently depends on coarse live-status normalization. The operator wants a local-first model: poll thread roster state for office tables and employee heads, then only subscribe/resume a thread when an individual chat panel is opened.

## Goal

Implement a reliable Codex-thread live-status bridge for employee loaders without making the whole office depend on transcript streaming. The default office path should remain cheap polling, while the focused chat path can use app-server `thread/resume` notifications for an active thread.

## Acceptance Criteria

- [x] AC-1: Codex runtime status normalization maps `thread.status` from `thread/list` into stable `AgentLiveStatus` states and employee loader/head signals without fetching full transcript turns.
- [x] AC-2: The office data path preserves cheap roster polling for tables, teams, and employee heads, with no whole-office subscription requirement and no transcript fetch unless a chat/session panel requests it.
- [x] AC-3: The focused thread/chat path has a documented implementation route for `thread/resume` streaming notifications, including reconnect/poll fallback and normalized progress events.
- [x] AC-4: Tests cover active, idle, error, and not-loaded Codex thread states, plus office mapper propagation into employee `statusMessage`, `heartbeatState`, and bubbles.

## Agent Contract

- Open: inspect `ui/src/modules/runtime/lib/codex-app-server/*`, `ui/src/modules/runtime/lib/adapters/codex-runtime-adapter.ts`, `ui/src/providers/office-data-provider.tsx`, `ui/src/providers/office-data-mapper.ts`, `ui/src/modules/office/components/employee/StatusBubbles.tsx`, and app-server generated schema if method shapes are unclear
- Test hook: `npm run --workspace @farplane/ui test -- runtime-adapters` or the closest existing Vitest target, plus focused provider/mapper tests
- Stabilize: keep Codex app-server protocol details inside the runtime module or state gateway; do not couple Three.js employee components directly to Codex thread schemas
- Inspect: `ui/src/modules/runtime/lib/codex-app-server/normalizers.ts`, `ui/src/modules/runtime/lib/codex-app-server/types.ts`, `ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts`, `ui/src/providers/office-data-mapper.ts`, `ui/src/providers/office-data-provider.test.ts`
- Key screens/states: office roster with active Codex thread, idle Codex thread, system-error thread, selected employee chat panel opened against a running thread
- Taste refs: root `AGENTS.md`, `ui/src/modules/runtime/AGENTS.md`, `ui/src/modules/office/AGENTS.md`, `ui/src/modules/chat/AGENTS.md`, Codex app-server docs/manual
- Expected artifacts: richer Codex live-status helper, focused adapter tests, office mapper/provider propagation tests, short notes on focused streaming route
- Delegate with: reviewer/QA only if the implementation grows beyond runtime normalization and focused tests

## Evidence Checklist

- [ ] Screenshot:
- [ ] Snapshot: test output for Codex live-status normalization
- [ ] Snapshot: office mapper/provider propagation test output
- [ ] QA report linked:

## Build Notes

- Current docs/manual evidence: Codex app-server exposes `thread/list`, `thread/read`, `thread/resume`, `thread/unsubscribe`, and streaming notifications such as `thread/status/changed`, `turn/started`, `item/started`, `item/agentMessage/delta`, `item/completed`, command/tool progress, and `turn/completed`.
- Recommended architecture: poll `thread/list` every few seconds for roster/head status; call `thread/resume` only when an individual thread/chat panel opens; keep `thread/read({ includeTurns: true })` as reconciliation or transcript fetch, not as the office heartbeat.
- Browser-to-Codex direct WebSocket is not the first implementation target because the docs mark WebSocket transport experimental/unsupported and protocol churn should stay behind the Farplane runtime/gateway boundary.
- Implemented runtime normalization in `toCodexLiveStatus(...)`: `active` maps to `running` plus loader bubbles, `systemError` maps to `error`, `idle` remains idle, and `notLoaded` remains non-running with explicit status text.
- Added a focused adapter test proving `getAgentsLiveStatus(...)` uses `thread/list` only for live employee status and does not call `thread/read`.
- Added an office data test proving normalized live status reaches employee `statusMessage`, `heartbeatState`, and `heartbeatBubbles`.
- Documented the selected-thread streaming route in `ui/src/modules/runtime/README.md`: `thread/resume({ threadId })` is reserved for an opened chat/session panel, with `thread/list` / `thread/read` fallback on reconnect.
- `npm run ui:typecheck` is blocked by broad existing UI type errors unrelated to this slice, including circular `src/App.tsx` aliases, missing AI Elements dependencies, JSX namespace failures, and existing provider/runtime type mismatches. A fresh typecheck capture found zero errors matching the TKT-005 touched TS files.

## QA Reconciliation

- AC-1: `PASS`
- AC-2: `PASS`
- AC-3: `PASS`
- AC-4: `PASS`
- Screen: `NOT PROVABLE`
- Evidence item: `CAPTURED`

## Artifact Links

- Program: `tickets/review/TKT-005-codex-thread-live-status-goal/program.md`
- Progress: `tickets/review/TKT-005-codex-thread-live-status-goal/progress.md`
- Focused tests: `npm run test:once -- ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts ui/src/providers/office-data-provider.test.ts`
- Targeted lint: `npx biome lint --diagnostic-level=error --files-ignore-unknown=true --skip=style --skip=complexity --skip=a11y --skip=correctness/noUnusedImports --skip=correctness/useExhaustiveDependencies --skip=correctness/useHookAtTopLevel --skip=suspicious/noArrayIndexKey ui/src/modules/runtime/lib/codex-app-server/normalizers.ts ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts ui/src/providers/office-data-provider.test.ts ui/src/modules/runtime/README.md tickets/review/TKT-005-codex-thread-live-status-goal/ticket.md tickets/review/TKT-005-codex-thread-live-status-goal/program.md tickets/review/TKT-005-codex-thread-live-status-goal/progress.md`
- Typecheck attempt: `npm run ui:typecheck` (blocked by unrelated existing UI errors; zero matches for `normalizers.ts`, `runtime-adapters.test.ts`, or `office-data-provider.test.ts`)

## User Evidence

- Hero screenshot:
- Supporting evidence:
- QA report:
- Final verdict:

## Required Evidence

- [x] Unit/integration/e2e tests pass (as applicable)
- [x] Narrow typecheck evidence captured (full UI typecheck blocked by unrelated existing UI errors; no touched-file errors found)
- [x] Lint passes
