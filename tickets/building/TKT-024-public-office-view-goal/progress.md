---
ticket: TKT-024
title: Public read-only office view progress
status: active
created_at: 2026-06-14
---

# Progress

## 2026-06-14 Goal Packet Created

- trigger: operator asked to turn the livestream/public read-only office view
  advice into a `goal-advisor` packet and run it
- intent: implement a safe public office route for livestreaming the AI office
  harness without accidental writes or obvious private leakage
- actions:
  - created TKT-024 packet
  - classified loop as `active_goal`
  - encoded route/shell/access mode, adapter write blocking, provider
    read-only behavior, UI gating, redaction, tests, and browser proof
  - generated native Goal prompt
  - updated `tickets/INDEX.md`
- files/artifacts:
  - `tickets/building/TKT-024-public-office-view-goal/ticket.md`
  - `tickets/building/TKT-024-public-office-view-goal/program.md`
  - `tickets/building/TKT-024-public-office-view-goal/progress.md`
  - `tickets/building/TKT-024-public-office-view-goal/generated-goal-prompt.md`
- metric sample:
  - packet files created
  - implementation not started
- drift verdict: aligned with operator request; no auth/deployment scope included
- next_action: launch native Goal and begin implementation
- blockers: repo-local goal-loop templates/spec referenced by the installed
  skill were not present, so this packet follows existing in-repo Goal Packet
  examples and the installed `goal-advisor` prompt template

## 2026-06-14 First Goal Turn

- trigger: native Goal execution for TKT-024
- intent: create the first safe public office slice with route/access mode,
  adapter write blocking, provider read-only behavior, and launcher gating
- actions:
  - added `/office/public` route with `OfficePage accessMode="public"`
  - added typed office access mode provider and shell `accessMode`
    normalization
  - added read-only runtime adapter proxy that blocks representative write-ish
    methods with `readonly_mode`
  - wired `useOfficeRuntimeAdapter()` to return the read-only proxy when the
    current office tree is public/viewer mode
  - made `OfficeDataProvider` skip placement-repair persistence in read-only
    mode
  - gated mutating office launcher actions and QA bridge actions in read-only
    mode
  - stopped mounting chat, agent session, manage-agent, team workspace,
    CEO workbench, settings, builder toolbar, object config, object transform,
    onboarding, and team options surfaces in read-only mode
  - added a visible `Public View` / `Read-only` badge
- files/artifacts:
  - `ui/src/AppRouter.tsx`
  - `ui/src/pages/OfficePage.tsx`
  - `ui/src/providers/office-access-mode-provider.tsx`
  - `ui/src/providers/office-data-provider.tsx`
  - `ui/src/shell/types.ts`
  - `ui/src/shell/shell-config.ts`
  - `ui/src/shell/shell-config.test.ts`
  - `ui/src/modules/runtime/runtime-adapter-provider.tsx`
  - `ui/src/modules/runtime/index.ts`
  - `ui/src/modules/runtime/lib/adapters/index.ts`
  - `ui/src/modules/runtime/lib/adapters/read-only-adapter.ts`
  - `ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts`
  - `ui/src/components/office-simulation.tsx`
  - `ui/src/components/hud/office-command-palette.tsx`
  - `ui/src/components/hud/office-menu.tsx`
  - `ui/src/components/hud/office-panel-registry.ts`
  - `ui/src/components/hud/office-panel-registry.test.ts`
  - `tickets/building/TKT-024-public-office-view-goal/public-route-smoke.png`
- checks:
  - `npm run test:once -- ui/src/shell/shell-config.test.ts ui/src/components/hud/office-panel-registry.test.ts ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts` passed: 3 files, 28 tests
  - `git diff --check -- ...TKT-024 touched files...` passed
  - filtered UI typecheck shows no touched implementation-file errors; remaining matches were two existing `ui/src/providers/office-data-provider.test.ts` role-union errors
- browser/QA sample:
  - dev server: `http://127.0.0.1:5173/`
  - route: `http://127.0.0.1:5173/office/public`
  - DOM proof: `Public View` badge was present
  - QA bridge safe list contained only `Evals`, `Harness`, `Organization`,
    `Skill OS`, and `Telemetry`
  - QA bridge blocked mutating commands: `builder-mode=false`,
    `settings=false`, `team-workspace=false`
  - screenshot saved at `public-route-smoke.png`
- metric sample:
  - access mode, adapter write-blocking, and action gating have focused tests
  - blocked write proof covers `saveOfficeObjects`, `saveOfficeSettings`,
    `sendMessage`, and `upsertOfficeObject`
- drift verdict: aligned with TKT-024 first slice; no auth, deployment, invite
  link, or broad privacy/compliance scope added
- next_action: continue with deeper panel-level redaction/disabled states,
  provider skip test coverage, and a browser proof path that can create a
  headless WebGL context or an alternate visual QA capture
- blockers:
  - Playwright headless route probe hit `THREE.WebGLRenderer: Error creating
    WebGL context`; public badge and QA bridge proof were captured, but full
    3D scene screenshot proof remains incomplete

## 2026-06-14 Goal Completion Pass

- trigger: continue active native Goal after first public-route slice
- intent: close the remaining provider proof, public panel gating, redaction,
  browser QA, and ticket reconciliation gaps
- actions:
  - extracted `persistPlacementRepairIfAllowed()` from `OfficeDataProvider`
    placement-repair persistence and added a no-save read-only test
  - made Organization public mode display-only by hiding create/manage/recruit
    tabs, CEO/PM assignment controls, and raw project paths
  - made Skill OS public mode read-only by hiding file/editor/demo/control tabs
    and suppressing skill enable/disable buttons in the sidebar
  - hid raw telemetry in public mode while keeping telemetry dashboard,
    projects, and teams summaries available
  - captured browser screenshots and DOM/QA-helper proof for `/office/public`
  - reconciled all ticket ACs and evidence links
- files/artifacts:
  - `ui/src/providers/office-data-provider.tsx`
  - `ui/src/providers/office-data-provider-readonly.test.ts`
  - `ui/src/components/hud/organization-panel.tsx`
  - `ui/src/modules/office/components/skills-panel.tsx`
  - `ui/src/modules/office/components/skills-panel-sidebar.tsx`
  - `ui/src/modules/telemetry/telemetry-dashboard-content.tsx`
  - `tickets/building/TKT-024-public-office-view-goal/artifacts/browser-qa-2026-06-14/qa-report.md`
  - `tickets/building/TKT-024-public-office-view-goal/artifacts/browser-qa-2026-06-14/browser-proof.json`
  - `tickets/building/TKT-024-public-office-view-goal/artifacts/browser-qa-2026-06-14/skill-os-dom-proof.json`
  - `tickets/building/TKT-024-public-office-view-goal/artifacts/browser-qa-2026-06-14/01-public-route.png`
  - `tickets/building/TKT-024-public-office-view-goal/artifacts/browser-qa-2026-06-14/02-organization-public.png`
  - `tickets/building/TKT-024-public-office-view-goal/artifacts/browser-qa-2026-06-14/03-skill-os-public.png`
  - `tickets/building/TKT-024-public-office-view-goal/artifacts/browser-qa-2026-06-14/04-telemetry-public.png`
- checks:
  - `npm run test:once -- ui/src/shell/shell-config.test.ts ui/src/components/hud/office-panel-registry.test.ts ui/src/modules/runtime/lib/adapters/runtime-adapters.test.ts ui/src/providers/office-data-provider-readonly.test.ts` passed: 4 files, 30 tests
  - `npm run --workspace @farplane/ui typecheck -- --pretty false | rg ...` showed no public-view/touched-file errors; remaining matches were existing `ui/src/providers/office-data-provider.test.ts` role-union errors
  - `git diff --check -- ...TKT-024 touched files...` passed
- browser/QA sample:
  - route: `http://127.0.0.1:5173/office/public`
  - public badge: true
  - canvas present: true
  - safe QA panels: `Evals`, `Harness`, `Organization`, `Skill OS`, `Telemetry`
  - blocked QA commands: `builder-mode=false`, `settings=false`,
    `team-workspace=false`, `ceo-workbench=false`, `human-review=false`,
    `office-shop=false`
  - organization public view hid create/manage/recruit, CEO thread control, and
    local path markers
  - Skill OS DOM proof found no exact mutating buttons or textareas in public
  - telemetry public view hid `Raw Telemetry`
- metric sample:
  - public route, read-only adapter, provider skip, launcher gating, panel
    gating/redaction, and browser proof are all covered
- drift verdict: aligned with TKT-024; no auth, deployment, invite links,
  remote hosting, or broad privacy/compliance sweep added
- next_action: operator review or closeout/commit prep
- blockers:
  - full UI typecheck still has pre-existing `office-data-provider.test.ts`
    role-union errors unrelated to the public-view implementation
