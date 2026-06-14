---
id: TKT-024
title: Public read-only office view for livestreaming
state: building
owner: Farplane UI
assignee: Codex
created_at: 2026-06-14
complexity: L
---

# TKT-024: Public Read-Only Office View for Livestreaming

## Status

- state: `building`
- owner: Farplane UI
- assignee: Codex
- dependencies: renderer shell config, office data provider, runtime adapter capability split
- location: `tickets/building/TKT-024-public-office-view-goal`
- enter when: operator wants to livestream the AI office harness as a website without risking writes or private leakage
- leave when: public office route is implemented, write paths are blocked, sensitive surfaces are gated/redacted, and browser proof exists
- blockers: none known
- spawned follow-ups: none yet
- complexity: `L`

## Description

Create a livestream-safe public office view for Farplane UI. The view should
render the live office in read-only mode while preventing accidental operator
actions such as chat sends, approvals, settings saves, builder edits, object
mutations, task updates, mesh generation, and provider resyncs.

This is not just a cosmetic route. Public view must combine route/shell mode,
UI affordance gating, runtime adapter write blocking, provider-side read-only
behavior, and basic redaction for stream-sensitive data.

## Goal

Let the operator open a website route that can be safely livestreamed while the
AI office harness works. Viewers should see live office activity and high-level
status, but the page must not mutate local sidecars, runtime state, Convex
board state, or Codex/OpenClaw state.

## Scope

- In scope:
  - Add a public/read-only office entry route such as `/office/public`.
  - Add a first-class shell/access mode, e.g. `accessMode: "operator" | "viewer" | "public"`.
  - Add an app-level access-mode context or equivalent helper consumed by office, provider, and runtime surfaces.
  - Add a read-only runtime adapter wrapper that blocks write-ish methods with a stable `readonly_mode` result.
  - Ensure `OfficeDataProvider` does not persist placement repairs or other automatic writes while read-only/public mode is active.
  - Gate or hide mutating UI surfaces: builder mode, decoration shop, object config/transform, settings saves, chat sends, approvals, resync/policy writes, mesh generation/download, team/project creation, and agent/session write controls.
  - Keep safe read-only surfaces available: 3D office scene, live statuses, telemetry summaries, organization/team overview, logs/status where they do not expose secrets, Skill OS/Harness/Evals viewers where write controls are disabled.
  - Add a visible `Public View` or `Read-only` indicator.
  - Add focused tests for access mode normalization, adapter write blocking, provider read-only persistence skipping, and launcher gating.
  - Capture browser evidence for public route render, no mutating controls, keyboard shortcut gating, and read-only mutation blocking.
- Out of scope:
  - Authentication, invite links, remote deployment, or internet-exposed hosting.
  - Full privacy scrub of every possible text field beyond obvious sensitive display fields.
  - Reworking the runtime adapter architecture beyond a narrow read-only wrapper.
  - Changing operator `/office` behavior.

## Surface Inventory

- Route/shell:
  - `ui/src/AppRouter.tsx`
  - `ui/src/pages/OfficePage.tsx`
  - `ui/src/shell/shell-config.ts`
  - `ui/src/shell/FarplaneShell.tsx`
- Provider/state:
  - `ui/src/providers/office-data-provider.tsx`
  - `ui/src/providers/office-data-mapper.ts`
  - `ui/src/modules/office/store/*`
- Runtime adapter:
  - `ui/src/modules/runtime/lib/adapters/contract.ts`
  - `ui/src/modules/runtime/runtime-adapter-provider.tsx`
  - `ui/src/modules/runtime/lib/adapters/factory.ts`
  - `ui/src/modules/runtime/lib/openclaw/adapter.ts`
  - `ui/src/modules/runtime/lib/codex-app-server/client.ts`
- Office scene/HUD:
  - `ui/src/components/office-simulation.tsx`
  - `ui/src/components/hud/office-menu.tsx`
  - `ui/src/components/hud/office-panel-registry.ts`
  - `ui/src/components/hud/builder-toolbar.tsx`
  - `ui/src/components/hud/furniture-shop.tsx`
  - `ui/src/components/hud/user-tasks-panel.tsx`
  - `ui/src/components/hud/ceo-task-detail-modal.tsx`
  - `ui/src/components/hud/create-team-form.tsx`
- Office mutation panels:
  - `ui/src/modules/office/components/object-config-panel.tsx`
  - `ui/src/modules/office/components/object-transform-panel.tsx`
  - `ui/src/modules/office/hooks/use-delete-office-object.ts`
  - `ui/src/modules/office/systems/placement-system.ts`
  - `ui/src/modules/office/scene/office-layout-editor.tsx`
- Chat/session/task surfaces:
  - `ui/src/modules/chat/hooks/use-chat-messages.ts`
  - `ui/src/modules/chat/hooks/use-chat-threads.ts`
  - `ui/src/modules/office/components/agent-session-panel.tsx`
  - `ui/src/modules/team-workspace/components/task-detail-modal.tsx`
- Settings/visibility:
  - `ui/src/modules/settings/settings-dialog.tsx`
  - `ui/src/modules/settings/use-codex-office-visibility-settings.ts`

## Acceptance Criteria

- [ ] AC-1: `/office/public` or equivalent public office route renders the office with `accessMode: "public"` and does not change normal `/office` behavior.
- [ ] AC-2: Access mode is a typed shell/config/context concept, not ad hoc component-local booleans.
- [ ] AC-3: Runtime adapter write methods are blocked in read-only/public mode with stable non-throwing `readonly_mode` results where callers expect result objects.
- [ ] AC-4: `OfficeDataProvider` skips automatic persistence, including placement repair writes, when public/read-only mode is active.
- [ ] AC-5: Global menu, command palette, keyboard shortcuts, QA helper hooks, and HUD controls cannot open or execute mutating actions in public view.
- [ ] AC-6: Chat/session send controls, board approval/task update controls, settings saves, builder/decor/object mutation controls, mesh generation/download, team/project creation, resync, and policy/provider writes are disabled or hidden in public view.
- [ ] AC-7: Safe read-only information remains useful: office scene, live statuses, high-level team/org status, telemetry summaries, and non-mutating viewers.
- [ ] AC-8: Stream-sensitive fields are redacted or hidden at least for local paths, provider URLs, raw thread IDs, private workspace file paths, tokens, raw prompts/notes where shown in broad panels, and save/config controls.
- [ ] AC-9: A visible `Public View` / `Read-only` indicator is present on the public route.
- [ ] AC-10: Tests and browser proof demonstrate the route, gating, adapter blocking, and absence of mutating controls.

## Agent Contract

- Open:
  - `AGENTS.md`
  - `PROJECT_RULES.md`
  - `ARCHITECTURE.md`
  - `ui/src/modules/AGENTS.md`
  - `ui/src/modules/office/AGENTS.md`
  - `ui/src/providers/AGENTS.md`
  - `ui/src/modules/runtime/AGENTS.md`
  - `qa/README.md`
  - relevant `qa/cookbook/*` page before browser proof
- Test hook:
  - focused Vitest tests for shell/access mode and read-only adapter wrapper
  - focused provider test for no placement-repair persistence in read-only mode
  - focused launcher/registry test for hidden/disabled mutating actions
  - browser QA for `/office/public`
- Stabilize:
  - block writes at adapter boundary even when UI gating misses a control
  - keep normal `/office` operator mode unchanged
  - preserve runtime adapter capability semantics
  - do not introduce auth/deployment scope
- Inspect:
  - all write-ish adapter methods and direct Convex command hooks
  - menu/keyboard/QA helper action paths
  - provider auto-repair persistence
  - panels that expose local paths or private identifiers
- Key screens/states:
  - `/office/public` full office scene
  - public mode badge
  - global menu in public mode
  - command palette or QA helper action attempt in public mode
  - chat/session panel with send disabled or hidden
  - team/workbench/review surfaces with approvals disabled or hidden
  - settings/builder/decor controls hidden or disabled
- Taste refs:
  - current Farplane office dark HUD style
  - restrained operational badge/chrome, no landing-page treatment
- Expected artifacts:
  - screenshots and QA report under this ticket's `artifacts/` folder
  - progress entries after each material pass
- Delegate with:
  - implementation lane for adapter/provider/access-mode changes
  - visual QA lane for browser screenshots and shortcut/probe checks

## Evidence Checklist

- [ ] Screenshot: `/office/public` renders the office scene.
- [ ] Screenshot: public/read-only indicator visible.
- [ ] Screenshot: global menu shows only safe read-only actions.
- [ ] Screenshot: chat/session send controls disabled or hidden.
- [ ] Screenshot: settings/builder/decor/object mutation controls disabled or hidden.
- [ ] Screenshot: team/workbench/review approvals disabled or hidden.
- [ ] Snapshot/log: attempted blocked adapter mutation returns `readonly_mode`.
- [ ] Snapshot/log: provider placement repair does not call save methods in public mode.
- [ ] Snapshot/log: keyboard shortcut or QA helper cannot execute mutating action.
- [ ] QA report reconciles observed public route against acceptance criteria.

## Build Notes

- Preferred implementation shape:
  - `AccessMode := "operator" | "viewer" | "public"`
  - `isReadOnlyAccessMode(mode) -> boolean`
  - `createReadOnlyRuntimeAdapter(adapter, mode) -> OfficeRuntimeAdapter`
  - `useOfficeAccessMode() -> { accessMode, isReadOnly, isPublic }`
- Public view should be stricter than viewer mode:
  - viewer: no writes
  - public: no writes plus basic redaction and stream-friendly chrome
- Add access mode near shell/app context, not as unrelated module-local state.
- Return stable result objects for blocked writes to avoid breaking current UI error handling.
- Do not rely only on disabling buttons; block at the adapter boundary.

## QA Reconciliation

- AC-1: `PASS` - `/office/public` renders with `accessMode: "public"`; `/office`
  keeps operator defaults.
- AC-2: `PASS` - access mode is typed in shell config and app context.
- AC-3: `PASS` - read-only runtime adapter returns stable `readonly_mode`
  results for write-ish methods without invoking the wrapped adapter.
- AC-4: `PASS` - `OfficeDataProvider` placement-repair persistence is guarded
  by a tested read-only helper that does not call save methods.
- AC-5: `PASS` - public menu/command/QA bridge expose only read-oriented panel
  actions and return `false` for tested mutating commands.
- AC-6: `PASS` - chat/session/team/workbench/settings/builder/decor/object
  mutation surfaces are unmounted or hidden in read-only/public mode; Skill OS,
  organization, and telemetry public panels suppress write controls.
- AC-7: `PASS` - public route keeps the office canvas, live status chrome,
  organization overview/directory, Skill OS/Evals/Harness summaries, and
  telemetry summaries available.
- AC-8: `PASS` - public route hides local project paths in Organization, raw
  telemetry rows/turn IDs, Skill OS file/editor/demo/control surfaces, and
  save/config controls.
- AC-9: `PASS` - `Public View` indicator is visible on the public route.
- AC-10: `PASS` - focused tests, touched-file typecheck filter, diff check, and
  browser QA artifacts recorded.
- Screen: `PASS` - screenshots under
  `artifacts/browser-qa-2026-06-14/`.
- Evidence item: `PASS` - blocked mutation/provider/browser proof recorded.

## Artifact Links

- Goal program: `tickets/building/TKT-024-public-office-view-goal/program.md`
- Goal progress: `tickets/building/TKT-024-public-office-view-goal/progress.md`
- Generated Goal prompt: `tickets/building/TKT-024-public-office-view-goal/generated-goal-prompt.md`
- Public route smoke screenshot: `tickets/building/TKT-024-public-office-view-goal/public-route-smoke.png`
- QA report:
  `tickets/building/TKT-024-public-office-view-goal/artifacts/browser-qa-2026-06-14/qa-report.md`
- Screenshot folder:
  `tickets/building/TKT-024-public-office-view-goal/artifacts/browser-qa-2026-06-14/`

## User Evidence

- Hero screenshot: pending
- Supporting evidence: pending
- QA report: pending
- Final verdict: pending

## Required Evidence

- [x] Focused tests pass.
- [x] Typecheck or touched-file typecheck shows no public-view errors.
- [x] Browser screenshots prove public mode and gated states.
- [x] QA report reconciles screenshots and blocked mutations against acceptance criteria.
