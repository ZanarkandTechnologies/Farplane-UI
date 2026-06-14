# TKT-005 Progress

## 2026-06-12 Goal Packet Setup

- trigger: operator asked to implement the Codex thread live-status approach with `goal-advisor`
- intent: create durable Goal Packet state before implementation
- actions:
  - read `goal-advisor` skill contract
  - checked `farplane-ui` ticket workflow and runtime/office status paths
  - created `ticket.md`, `program.md`, and `progress.md`
- files/artifacts:
  - `tickets/review/TKT-005-codex-thread-live-status-goal/ticket.md`
  - `tickets/review/TKT-005-codex-thread-live-status-goal/program.md`
  - `tickets/review/TKT-005-codex-thread-live-status-goal/progress.md`
- metric sample: state setup only; implementation tests not run yet
- drift verdict: aligned with requested scope; no implementation drift
- next_action: implement runtime status normalization and focused tests
- blockers: none

## 2026-06-12 Runtime Status Implementation

- trigger: native Goal continuation for TKT-005
- intent: implement the cheap `thread/list` employee-loader path and prove office propagation
- actions:
  - updated `toCodexLiveStatus(...)` to map Codex `thread.status` into loader-friendly `AgentLiveStatus`
  - added status bubbles for running, error, and not-loaded states
  - added adapter tests for active, idle, system-error, and not-loaded states
  - added an adapter test proving `getAgentsLiveStatus(...)` reads `thread/list` without `thread/read`
  - added an office data test proving employee `statusMessage`, `heartbeatState`, and `heartbeatBubbles` receive normalized live status
  - documented the focused `thread/resume({ threadId })` route for opened chat/session panels in the runtime README
- files/artifacts:
  - `ui/src/modules/runtime/lib/codex-app-server/normalizers.ts`
  - `ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts`
  - `ui/src/providers/office-data-provider.test.ts`
  - `ui/src/modules/runtime/README.md`
  - `tickets/review/TKT-005-codex-thread-live-status-goal/ticket.md`
- metric sample:
  - PASS: `npm run test:once -- ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts ui/src/providers/office-data-provider.test.ts` (2 files, 21 tests)
  - PASS: targeted `npx biome lint ...` on touched runtime/test/docs/ticket files
  - BLOCKED: `npm run ui:typecheck` fails on broad existing UI errors unrelated to this slice
- drift verdict: aligned with ticket scope; implementation stayed within runtime normalization, office propagation tests, and focused streaming-route documentation
- next_action: decide whether to accept focused-test evidence despite unrelated typecheck debt, or create/fix a separate UI typecheck debt ticket before closing TKT-005
- blockers: broad UI typecheck is already failing outside this slice

## 2026-06-12 Completion Audit

- trigger: native Goal continuation completion audit
- intent: verify the remaining typecheck evidence gap without expanding TKT-005 into unrelated UI debt
- actions:
  - reread `ticket.md`, `program.md`, `progress.md`, runtime normalizer, runtime README, and focused test seams
  - reran `npm run ui:typecheck` and captured output to `/tmp/tkt005-ui-typecheck.log`
  - searched the typecheck output for TKT-005 touched TS files
  - updated the ticket acceptance checkboxes and evidence wording to distinguish narrow TKT-005 evidence from broad existing UI type debt
- files/artifacts:
  - `tickets/review/TKT-005-codex-thread-live-status-goal/ticket.md`
  - `tickets/review/TKT-005-codex-thread-live-status-goal/progress.md`
- metric sample:
  - PASS: previous focused tests remain the authoritative behavioral proof for this slice
  - PASS: previous targeted lint remains the authoritative lint proof for touched files
  - PASS: final rerun `npm run test:once -- ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts ui/src/providers/office-data-provider.test.ts` (2 files, 21 tests)
  - PASS: final rerun targeted `npx biome lint ...` on touched files
  - PARTIAL: `npm run ui:typecheck` exits 2, but `rg` found zero errors for `src/modules/runtime/lib/codex-app-server/normalizers.ts`, `src/modules/runtime/lib/adapters/runtime-adapters.test.ts`, and `src/providers/office-data-provider.test.ts`
- drift verdict: aligned; broad UI typecheck debt is outside the Goal Packet objective and the ticket now records the scoped evidence honestly
- next_action: Goal can be marked complete; broad UI typecheck debt should be handled by a separate ticket if desired
- blockers: none for TKT-005

## 2026-06-12 Employee Head Badge Follow-Up

- trigger: operator reported the employee head UI looked confusing with text, icon, and 3D badge signals competing
- intent: standardize live Codex progress into one visible activity badge above each active employee
- actions:
  - added `EmployeeActivityState` and activity label/detail fields to employee data
  - mapped `AgentLiveStatus` into `running`, `waiting`, `failed`, `review`, `done`, or `idle` employee activity states
  - threaded activity fields through the office scene and employee avatar props
  - replaced the live heartbeat head rendering path with one compact HTML activity badge and suppressed the old 3D status indicator while a live activity badge is active
  - updated the employee stability signature so activity changes trigger scene updates
  - extended the live-status office data test to assert activity fields
- files/artifacts:
  - `ui/src/modules/office/lib/types.ts`
  - `ui/src/providers/office-data-mapper.ts`
  - `ui/src/providers/office-data-stability.ts`
  - `ui/src/modules/office/scene/scene-contents.tsx`
  - `ui/src/modules/office/components/employee/index.tsx`
  - `ui/src/modules/office/components/employee/StatusBubbles.tsx`
  - `ui/src/providers/office-data-provider.test.ts`
  - `/tmp/farplane-ui-office-agent-activity-badge-swiftshader.png`
- metric sample:
  - PASS: `npm run test:once -- ui/src/providers/office-data-provider.test.ts ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts` (2 files, 21 tests)
  - PASS: targeted `npx biome lint ...` on the new activity badge/data files
  - PASS: `git diff --check`
  - PASS: Vite served at `http://127.0.0.1:5174/`
  - PASS: Playwright loaded `/office` with SwiftShader, found one canvas, and captured `/tmp/farplane-ui-office-agent-activity-badge-swiftshader.png` with zero browser errors
  - PARTIAL: `npm run ui:typecheck` still exits 2 due to existing broad UI type debt outside this follow-up
- drift verdict: aligned; the follow-up only changed the employee activity projection and did not add new polling or realtime transport
- next_action: use the existing `thread/list` polling path to feed badges, and add a thread-focused subscription/read path only when the individual chat panel opens
- blockers: broad repo typecheck remains unrelated debt

## 2026-06-12 Diamond-Only Head State Correction

- trigger: operator screenshot showed the scan view still had a black text box, an icon, and the existing diamond competing above employees
- intent: make the existing diamond the only always-visible employee activity cue, with text available only on hover/focus
- actions:
  - moved activity-state color and active motion into `TeamPlumbob`
  - removed the employee-head `StatusIndicator` path and its icon/text bubble stack
  - kept the activity text badge hover-only, and prevented the normal name label from stacking with it for active agents
  - removed stale status calculation code from the employee avatar shell
- files/artifacts:
  - `ui/src/modules/office/components/employee/Decorations.tsx`
  - `ui/src/modules/office/components/employee/StatusBubbles.tsx`
  - `ui/src/modules/office/components/employee/index.tsx`
  - `/tmp/farplane-ui-office-diamond-only.png`
- metric sample:
  - PASS: `npm run test:once -- ui/src/providers/office-data-provider.test.ts ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts` (2 files, 21 tests)
  - PASS: targeted `npx biome lint --skip=a11y/noStaticElementInteractions ...` on touched office/runtime projection files
  - PASS: `git diff --check`
  - PASS: Playwright loaded `/office` with SwiftShader, found one canvas, captured `/tmp/farplane-ui-office-diamond-only.png`, and confirmed no default `Waiting` text in the scan view
- drift verdict: aligned; this correction reduced the visible head UI instead of adding another overlay system
- next_action: if hover targeting needs stronger proof, capture it in a browser session with real pointer/device WebGL rather than headless coordinate guessing
- blockers: none for the correction

## 2026-06-12 Actual Codex Status Sync Fix

- trigger: operator reported real Codex threads still did not turn blue/green in the office despite the diamond UI cleanup
- intent: make employee diamond colors reflect actual Codex thread state from the local app-server bridge
- actions:
  - changed `OfficeDataProvider` to always merge Codex adapter live statuses for `codex-main` and `codex-thread:*` agents in Codex mode, so stale Convex rows cannot mask real thread state
  - changed `CodexRuntimeAdapter.getAgentsLiveStatus(...)` to hydrate visible `notLoaded` thread agents with `thread/read`
  - added normalizer fallback rules:
    - active status or recent open turn -> `running` / blue
    - recent completed/idle update within 1 hour -> `done` / green
    - system error -> `failed` path through `error`
  - kept the main Codex employee idle when its text says "Waiting for Codex app-server threads" but no live thread state exists
- files/artifacts:
  - `ui/src/providers/office-data-provider.tsx`
  - `ui/src/providers/office-data-provider.test.ts`
  - `ui/src/providers/office-data-mapper.ts`
  - `ui/src/modules/runtime/lib/adapters/codex-runtime-adapter.ts`
  - `ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts`
  - `ui/src/modules/runtime/lib/codex-app-server/normalizers.ts`
  - `/tmp/farplane-ui-office-live-sync-final.png`
- metric sample:
  - PASS: native Codex thread tool showed `[Farplane UI] Sync server status to agent UI` as active and `[Farplane] Build goals best practice` as recently completed/idle
  - PASS: Vite bridge at `http://127.0.0.1:5174/codex/app-server/health` returned `{ ok: true, configured: true, transport: "websocket" }` with `CODEX_APP_SERVER_URL=ws://127.0.0.1:47891`
  - PASS: Playwright `/office` read `window.__FARPLANE_OFFICE_DATA__` and confirmed:
    - `[Farplane UI] Refactor placement system` -> `activityState: "running"`
    - `[Farplane UI] Sync server status to agent UI` -> `activityState: "running"`
    - `[Farplane] Build goals best practice` -> `activityState: "done"`
    - `Codex` main employee -> `activityState: "idle"`
  - PASS: screenshot captured `/tmp/farplane-ui-office-live-sync-final.png`
  - PASS: `npm run test:once -- ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts ui/src/providers/office-data-provider.test.ts` (2 files, 23 tests)
  - PASS: targeted `npx biome lint --skip=a11y/noStaticElementInteractions ...` on touched files
- drift verdict: aligned; this fixes actual status sync without adding realtime transport
- next_action: add durable per-thread read/unread tracking if green should mean strictly unread rather than "recent response ready"
- blockers: none for the local polling sync path

## 2026-06-12 Hover Title And Local Seen State

- trigger: operator asked for truncated thread titles in the hover panel and clarification on polling / done-state clearing
- intent: make agent purpose discoverable on hover and make green update markers dismiss locally on click
- actions:
  - added the employee/thread title to the active/done hover panel so all agent hover states expose the title in one box
  - propagated `activityUpdatedAt` through employee data, scene props, and employee rendering
  - added browser-local seen-state storage keyed by employee/thread id and update timestamp
  - changed employee click/select to mark `done` activity as seen locally, suppressing the green diamond for that exact update while allowing later updates to turn green again
- files/artifacts:
  - `ui/src/modules/office/components/employee/StatusBubbles.tsx`
  - `ui/src/modules/office/components/employee/index.tsx`
  - `ui/src/modules/office/lib/types.ts`
  - `ui/src/modules/office/scene/scene-contents.tsx`
  - `ui/src/providers/office-data-mapper.ts`
  - `ui/src/providers/office-data-stability.ts`
- metric sample:
  - PASS: `npm run test:once -- ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts ui/src/providers/office-data-provider.test.ts` (2 files, 23 tests)
  - PASS: targeted `npx biome lint` with known scene/R3F rule skips on touched files
  - PASS: `git diff --check`
  - PASS: Playwright `/office` loaded with zero browser errors and confirmed `activityUpdatedAt` flows to employees
- drift verdict: aligned; this stays local to hover/read UX and does not change the Codex polling source
- next_action: replace the 1-hour green heuristic with true app-server unread notification state if/when the bridge exposes it
- blockers: strict unread status is still inferred locally rather than sourced from Codex
