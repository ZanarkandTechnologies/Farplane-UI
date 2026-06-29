---
template_id: ticket-template
template_version: "0.1.3"
feature_refs:
  - FEAT-0007
  - FEAT-0008
ticket_id: TASK-0033
title: split Team Workspace tabs into focused internal modules
phase: proof
status: review
owner: Farplane UI
claimed_by:
priority: high
depends_on: []
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-06-29T16:31:23Z
updated_at: 2026-06-29T16:48:11Z
next_action: review the behavior-preserving refactor and decide whether to commit
last_verification: "2026-06-29: npx biome check --files-ignore-unknown=true on touched Team Workspace split files; npm run test:once -- team-panel; npm run typecheck:root; filtered UI typecheck showed no ticket-owned errors; Playwright smoke opened global Team Panel tabs and verified Timeline Configure Hooks buttons"
---

# TASK-0033: Split Team Workspace Tabs Into Focused Internal Modules

## Summary

Refactor the Team Workspace tab layer so large tab files become focused
internal module folders instead of a flat pile of 500+ line components. Preserve
the Team Panel public behavior, tab values, launcher behavior, and existing data
flows while reducing the highest-maintenance hotspots identified by the
refactoring review.

## Scope

- In:
  - Keep `ui/src/modules/team-workspace` as the owning product module.
  - Move tab implementations into module-local folders such as `tabs/overview`,
    `tabs/project-config`, and `tabs/operator-intelligence`.
  - Split `farplane-project-config.tsx`, `overview-tab.tsx`, and
    `operator-intelligence-tabs.tsx` into smaller typed files with stable public
    exports.
  - Split `task-detail-modal.tsx` only where a behavior-preserving extraction is
    obvious and cheap.
  - Update imports, colocated tests, and module exports as needed.
  - Preserve the newly redesigned Timeline tab behavior and the Configure Hooks
    entrypoint.
- Out:
  - No new top-level `ui/src/modules/*` module per tab.
  - No broad visual redesign of Team Panel.
  - No behavior changes to data loading, store keys, tab ids, hook telemetry,
    Convex/local fallback semantics, or project config persistence.
  - No unrelated cleanup of `ui/src/modules/thread-data/components/thread-data-panel.tsx`.

## Delta

```text
overall_before:
  - Team Workspace tab files live mostly flat under components/.
  - Several tab files exceed the project 500-line warning threshold.
overall_after:
  - Team Workspace keeps one public module but has folderized internal tab
    surfaces with narrow files and stable entrypoints.
  - The worst tab hotspots are below or have explicit split plans when a file
    remains over 500 lines.
why_now:
  - Timeline UI work made the Team Panel easier to use, but the tab layer is
    now hard to evolve safely because older tabs mix fetching, parsing, derived
    state, and rendering in long files.
problems:
  - before: `farplane-project-config.tsx` owns config fetching, shared config
      types/parsers, and four rendered tab surfaces.
    after: config IO/parsing and each rendered project config tab have focused
      owners.
    why_now: Goals/Products/Cadence will likely keep growing as autonomous
      project surfaces mature.
  - before: `overview-tab.tsx` mixes KPI parsing, signal cards, roster layout,
      and 3D employee preview rendering.
    after: overview rendering delegates avatar preview, KPI derivation, and
      signal/card pieces to smaller local files.
    why_now: Overview is a high-traffic tab and should stay easy to scan.
  - before: `operator-intelligence-tabs.tsx` contains several mini-surfaces in
      one file.
    after: each exported intelligence tab and shared quest UI live in a small
      folder.
    why_now: The file is already a future-growth magnet.
first_principles_basis:
  objective: improve maintainability without changing Team Panel behavior
  need: tab work should be easy to reason about and review
  assumptions: line count is a smell, but responsibility boundaries decide the
    actual split
  root_cause: Team Workspace grew by adding tab files before internal tab
    folders existed
  constraints: preserve public module entrypoints, UI behavior, and current
    dirty worktree changes not owned by this ticket
  first_viable_slice: split the three largest tab hotspots plus cheap modal
    helper extractions
  proof_or_falsification: focused tests/typecheck pass and browser smoke shows
    Team Panel tabs still render
  tradeoff: more files/imports in exchange for smaller reasoning units
  non_goals: style-only churn, new abstractions outside Team Workspace, or
    redesigning the Team Panel UX
```

## Change Plan

### Change 1: Folderize Team Workspace tab entrypoints

```text
fixes:
  - Team Panel imports tab implementations from a flat components folder.
before:
  - `team-panel.tsx` imports `./overview-tab`, `./farplane-project-config`,
    `./kanban-tab`, `./timeline-tab`, and `./telemetry-tab`.
after:
  - Team Panel imports from focused tab folder entrypoints while tab ids and
    props remain stable.
read:
  - path: ui/src/modules/team-workspace/AGENTS.md
    reason: preserve module boundary and tab prop invariants.
  - path: ui/src/modules/team-workspace/README.md
    reason: update tab component documentation if needed.
  - path: ui/src/modules/team-workspace/components/team-panel.tsx
    reason: shell imports and tab composition.
write:
  - path: ui/src/modules/team-workspace/components/team-panel.tsx
    change: update imports only as needed.
  - path: ui/src/modules/team-workspace/components/tabs/**/*
    change: add internal tab folders and entrypoints.
  - path: ui/src/modules/team-workspace/README.md
    change: mention tab components now live under internal tab folders if the public API list changes.
operation:
  - Preserve `TabKey`, `TabsTrigger` values, `TabsContent` values, and props.
signature_or_type_impact:
  - No external TeamPanel API change.
routes:
  docs: update_docs
  qa: tests
  review: inline
qa:
  - Biome check Team Workspace touched files.
  - `npm run test:once -- team-panel`.
failure_modes:
  - Missed import path breaks a colocated test or public module export.
```

### Change 2: Split project config tabs and helpers

```text
fixes:
  - `farplane-project-config.tsx` is 855 lines and mixes config IO, parsing,
    shared display helpers, and four tab components.
before:
  - One file exports `useFarplaneProjectConfig`, config types/parsers, and
    `ProjectGoalsTab`, `ProjectProductsTab`, `ProjectCadenceTab`,
    `ProjectConfigTab`.
after:
  - Project config types/parsers/loading live in local logic files, and each
    rendered tab has its own focused file under `tabs/project-config`.
read:
  - path: ui/src/modules/team-workspace/components/farplane-project-config.tsx
    reason: source to split behavior-preservingly.
  - path: ui/src/modules/team-workspace/components/overview-tab.tsx
    reason: imports config helpers.
write:
  - path: ui/src/modules/team-workspace/components/tabs/project-config/config-types.ts
    change: move config row types.
  - path: ui/src/modules/team-workspace/components/tabs/project-config/config-parsing.ts
    change: move `findConfigFile`, `getConfigSection`, and markdown table helpers.
  - path: ui/src/modules/team-workspace/components/tabs/project-config/use-farplane-project-config.ts
    change: move config fetch hook.
  - path: ui/src/modules/team-workspace/components/tabs/project-config/goals-tab.tsx
    change: move goals tab UI.
  - path: ui/src/modules/team-workspace/components/tabs/project-config/products-tab.tsx
    change: move products tab UI.
  - path: ui/src/modules/team-workspace/components/tabs/project-config/cadence-tab.tsx
    change: move cadence tab UI.
  - path: ui/src/modules/team-workspace/components/tabs/project-config/source-config-tab.tsx
    change: move source config tab UI if still used.
  - path: ui/src/modules/team-workspace/components/tabs/project-config/index.ts
    change: stable re-export surface for Team Panel and Overview.
operation:
  - Prefer moving code over rewriting it; only dedupe helpers when behavior is
    easy to prove.
signature_or_type_impact:
  - Keep existing exported names available through the new folder index.
routes:
  docs: no_docs
  qa: tests
  review: inline
qa:
  - Typecheck catches import/type regressions.
  - Browser smoke covers Goals, Products, and Cadence tab render.
failure_modes:
  - Circular import between Overview and project config helper files.
```

### Change 3: Split Overview into derived data and rendering pieces

```text
fixes:
  - `overview-tab.tsx` is 775 lines and mixes data derivation, KPI cards, signal
    cards, and 3D employee previews.
before:
  - Overview owns helper types, KPI parsing, preview meshes, HUD metrics,
    signal card UI, and the main tab component.
after:
  - Overview keeps a small tab coordinator and delegates avatar preview,
    metrics/signals, and local helpers to nearby files.
read:
  - path: ui/src/modules/team-workspace/components/overview-tab.tsx
    reason: source to split behavior-preservingly.
  - path: ui/src/modules/team-workspace/components/overview-tab.helpers.ts
    reason: reuse existing helper location or move into overview folder.
  - path: ui/src/modules/team-workspace/components/overview-tab.helpers.test.ts
    reason: preserve helper tests.
write:
  - path: ui/src/modules/team-workspace/components/tabs/overview/overview-tab.tsx
    change: main OverviewTab component.
  - path: ui/src/modules/team-workspace/components/tabs/overview/employee-preview.tsx
    change: 3D preview mesh and wrapper.
  - path: ui/src/modules/team-workspace/components/tabs/overview/overview-cards.tsx
    change: HUD metric and signal cards.
  - path: ui/src/modules/team-workspace/components/tabs/overview/overview-helpers.ts
    change: markdown/KPI derivation helpers.
  - path: ui/src/modules/team-workspace/components/tabs/overview/overview-helpers.test.ts
    change: preserve helper tests under the new owner.
operation:
  - Keep `OverviewTab` props stable.
signature_or_type_impact:
  - No external TeamPanel API change.
routes:
  docs: no_docs
  qa: tests
  review: inline
qa:
  - Existing overview helper tests still pass.
  - Browser smoke covers Overview render and roster preview area.
failure_modes:
  - Three.js preview extraction can change canvas sizing if wrapper classes drift.
```

### Change 4: Split operator intelligence tabs by mini-surface

```text
fixes:
  - `operator-intelligence-tabs.tsx` is 697 lines and contains multiple exported
    tab surfaces plus shared quest UI.
before:
  - Goals, Docs, Skills readiness, quest map, progress meter, and shared cards
    all live in one file.
after:
  - Each exported intelligence tab and shared quest/card UI live in a local
    `tabs/operator-intelligence` folder.
read:
  - path: ui/src/modules/team-workspace/components/operator-intelligence-tabs.tsx
    reason: source to split behavior-preservingly.
write:
  - path: ui/src/modules/team-workspace/components/tabs/operator-intelligence/goals-tab.tsx
    change: move GoalsTab.
  - path: ui/src/modules/team-workspace/components/tabs/operator-intelligence/docs-tab.tsx
    change: move DocsTab.
  - path: ui/src/modules/team-workspace/components/tabs/operator-intelligence/skills-readiness-tab.tsx
    change: move SkillsReadinessTab.
  - path: ui/src/modules/team-workspace/components/tabs/operator-intelligence/quest-map.tsx
    change: move quest node/map shared UI.
  - path: ui/src/modules/team-workspace/components/tabs/operator-intelligence/shared.tsx
    change: move shared metric/card helpers.
  - path: ui/src/modules/team-workspace/components/tabs/operator-intelligence/index.ts
    change: stable re-export surface.
operation:
  - Keep exported names stable where any caller still imports them.
signature_or_type_impact:
  - No external TeamPanel API change expected.
routes:
  docs: no_docs
  qa: tests
  review: inline
qa:
  - Typecheck catches export drift.
failure_modes:
  - Some intelligence tabs may be currently unused; avoid deleting exports unless
    tests/typecheck prove no callers.
```

### Change 5: Extract cheap Task Detail Modal helpers if safe

```text
fixes:
  - `task-detail-modal.tsx` is 622 lines, but the component is less urgent than
    the tab hotspots.
before:
  - Modal helper parsing and full modal rendering live together.
after:
  - Pure ticket markdown/frontmatter/session helpers move to a local file if the
    extraction is low-risk; otherwise leave a clear split note.
read:
  - path: ui/src/modules/team-workspace/components/task-detail-modal.tsx
    reason: inspect safe extraction seams.
write:
  - path: ui/src/modules/team-workspace/components/task-detail-modal.helpers.ts
    change: optional helper extraction.
  - path: ui/src/modules/team-workspace/components/task-detail-modal.tsx
    change: import helpers if extracted.
operation:
  - Do not churn the modal layout just to satisfy line count.
signature_or_type_impact:
  - No prop change.
routes:
  docs: no_docs
  qa: tests
  review: inline
qa:
  - Kanban/task modal render remains covered by Team Panel smoke.
failure_modes:
  - Modal is large but coherent enough that forced splitting could hurt readability.
```

## Gap Analysis

- Current state: Team Workspace is correctly module-owned, but the internal tab
  layer is still mostly flat and several files breach the project large-file
  warning.
- Production expectation: A multi-tab operator panel should keep each tab's
  data derivation, reusable cards, and subviews discoverable without creating
  global utility buckets.
- Missing gaps: Internal folder entrypoints, smaller typed helper files, and
  stable tab re-export surfaces.
- Comparable implementations: Local project module rules and existing
  `business-flow/` folder inside Team Workspace.
- Recommendation: Folderize the Team Workspace tab layer now; defer unrelated
  Thread Data panel cleanup to a separate ticket.

## Done

```text
done_when:
  - Team Workspace tab implementations have focused internal folders for project
    config, overview, and operator intelligence.
  - `team-panel.tsx` remains a shell and preserves current tab ids, props, and
    Configure Hooks behavior.
  - The highest-priority Team Workspace hotspot files are either below 500 lines
    or replaced by focused files with an explicit residual split note.
  - Existing helper tests pass after moves.
  - Focused Team Panel tests, root typecheck, and browser smoke for relevant tabs
    have been run or blocked with an explicit reason.
```

## QA Strategy

```text
qa_strategy:
  proof_weight: visual_qa
  checks:
    - npx biome check --files-ignore-unknown=true ui/src/modules/team-workspace
    - npm run test:once -- team-panel
    - npm run typecheck:root
    - npm run --workspace @farplane/ui typecheck -- --pretty false | rg "team-workspace|team-panel|overview|project-config|operator-intelligence"
  manual:
    - Run the UI and smoke Team Panel tabs: Overview, Goals, Products, Kanban,
      Cadence, Timeline, and Telemetry.
    - Confirm Timeline still opens Configure Hooks.
    - Capture at least one best screenshot of the refactored Team Panel tab
      flow or block with the exact missing browser proof.
  delegated_lanes:
    - optional reviewer lane for final maintainability diff if the split touches
      more than 12 files
    - optional visual-qa lane if browser smoke reveals layout risk
  review:
    - rubric: behavior-preserving refactor, module boundaries, no generic utils,
      no unrelated dirty-worktree churn
      required_tas: inline unless the final diff is broad enough to warrant reviewer
  evidence:
    - command outputs summarized in progress.md
    - screenshot path linked in progress.md and final response
  goal_advisor_inputs:
    proof_route: executor runs focused checks and browser smoke; reviewer/visual-qa
      required only if diff breadth or UI evidence is risky
    final_evidence: final response includes ![best evidence](ABSOLUTE_SCREENSHOT_PATH)
      or blocks/revises with the exact missing screenshot proof
    final_checkpoint: compare diff against this ticket and program, update ticket
      and progress with checks, screenshot, residual risk, and review decision before
      stop_complete
  residual_risk:
    - Full UI workspace typecheck may still contain unrelated existing debt; if so,
      filtered Team Workspace output must be reported.
    - Existing dirty changes outside Team Workspace must not be reverted or folded
      into this ticket.
```

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - ui/src/modules/team-workspace/README.md
  no_docs_reason:
  validation:
    - README matches final internal tab folder layout.
```

## Agent Contract

- Open: `npm run ui`, then `/office` and open the Team Panel for Farplane UI or
  use the existing app-store smoke hook if available.
- Test hook: targeted Vitest commands plus browser smoke.
- Stabilize: prefer existing seeded office/company state; do not add new
  localStorage or fallback config.
- Inspect: Team Panel tab labels, active tab content, Timeline Configure Hooks
  button, console/page errors.
- Key screens/states: Overview, Goals, Products, Kanban, Cadence, Timeline,
  Telemetry.
- Design baseline: current Team Panel UI; this ticket is structural, not a new
  design pass.
- QA cookbook: `qa/README.md`; no dedicated Team Panel cookbook yet.
- Taste refs: preserve current compact operational panel style.
- Expected artifacts: one screenshot under `tickets/TASK-0033/artifacts/` or a
  clear blocker.
- Delegate with: this ticket path plus `program.md` if reviewer/visual QA is used.

## Run Hints

- Likely size: normal
- Goal recommendation: required
- Budget hint: one focused local pass; no external spend; subagents optional for
  final review only
- Compute hint: local_shared
- Planning hint: light
- QA source: QA Strategy
- Batchability: single-ticket
- Batch reason: one Team Workspace refactor surface with shared proof path
- Human inputs/assets: none
- Credentials / external access: none
- Compute/runtime needs: local UI dev server for browser smoke
- Tooling gaps: none
- QA risks: browser smoke can be noisy because office route may have unrelated
  WebGL/gateway errors; report unrelated errors separately
- Human gates: none; operator explicitly requested Goal creation and implementation
- Agent decision boundaries: preserve behavior; do not redesign Team Panel or
  refactor unrelated modules

## Links

- `program:` `tickets/TASK-0033/program.md`
- `progress:` `tickets/TASK-0033/progress.md`
- `goal_prompt:` `tickets/TASK-0033/goal.md`
- `artifacts:` `tickets/TASK-0033/artifacts/`
- `review:` inline maintainability/proof review complete; no delegated reviewer used
- `refs:`
  - `ui/src/modules/team-workspace/AGENTS.md`
  - `ui/src/modules/team-workspace/README.md`
  - `PROJECT_RULES.md`
  - `tickets/TASK-0033/artifacts/team-panel-tabs-smoke.png`
  - `tickets/TASK-0033/artifacts/team-panel-timeline-configure-hooks.png`

## Notes

- Refactoring review found a larger unrelated hotspot in
  `ui/src/modules/thread-data/components/thread-data-panel.tsx`; leave that for
  a separate ticket because it belongs to a different module and appears dirty
  from another lane.
- Structure delta:
  - `farplane-project-config.tsx`: 855 lines to 17-line compatibility export
    plus focused `tabs/project-config/*` files.
  - `overview-tab.tsx`: 775 lines to 1-line compatibility export plus focused
    `tabs/overview/*` files; main Overview coordinator is 429 lines.
  - `operator-intelligence-tabs.tsx`: 697 lines to 9-line compatibility export
    plus focused `tabs/operator-intelligence/*` files.
  - `task-detail-modal.tsx`: 622 lines to 488 lines, with pure helpers,
    markdown preview dialog, and review/linked-context sections extracted.
- Full UI workspace typecheck still fails on unrelated existing debt outside
  ticket-owned files, including Convex projection typing, app circular aliases,
  missing AI package types, and older `JSX` namespace returns.
