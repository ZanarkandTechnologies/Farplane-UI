---
ticket_id: TASK-0031
title: Add per-project Timeline hook configuration UI
phase: proof
status: review
owner: Farplane UI
claimed_by: codex-019f1214
priority: high
depends_on:
  - TASK-0027
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-06-29
updated_at: 2026-06-29
next_action: review implementation, then decide whether to wire executable event-program config
last_verification: "2026-06-29: npm run test:once -- hooks/shared/project-hook-config.test.ts hooks/file-change-listener/handler.test.ts; npx biome check --files-ignore-unknown=true ui/src/modules/hook-telemetry/raw-telemetry-panel.tsx ui/src/modules/hook-telemetry/timeline-hook-panels.tsx hooks/shared/project-hook-config.ts hooks/file-change-listener/run.ts hooks/shared/project-hook-config.test.ts ui/vite.config.ts; npm run typecheck:root; Playwright smoke for /hook-telemetry Hooks and Programs tabs"
---

# TASK-0031: Add Per-Project Timeline Hook Configuration UI

## Summary

Turn the raw hook telemetry panel into a per-project Timeline control surface.
The Timeline should show hook events, per-project hook configuration, hook
delivery previews, and the first Event Programs placeholder without moving
runtime policy into browser state.

## Scope

- In:
  - Rename the operator surface from raw-only telemetry toward Project Timeline.
  - Add Timeline tabs for Events, Hooks, Programs, Raw, and Distribution.
  - Reshape the Hooks tab into a list/detail layout with file-change listener
    status, capture controls, summary toggle, active patterns, and recent event
    preview.
  - Persist summary enablement in `.farplane/hooks/config.json` and make the
    file-change hook skip summary events when disabled while still emitting
    typed Farplane file events.
  - Add an Event Programs tab as a visible routing cockpit placeholder that
    explains the future event-to-mining-program split without scheduling jobs.
  - Update hook telemetry docs and run focused tests/typecheck.
- Out:
  - No new local daemon, queue, or job runner.
  - No tracked `farplane/event-programs.json` schema yet.
  - No provider webhook implementation.
  - No broad navigation redesign outside the hook telemetry module.

## Delta

```text
overall_before:
  - Raw Telemetry has Events, Distribution, and a basic Hooks setup form.
  - The file-change hook always attempts summary bubbles when enabled.
overall_after:
  - Project Timeline has Events, Hooks, Programs, Raw, and Distribution tabs.
  - Hooks are configured per project with previewable delivery rows.
  - Summary bubble generation is an explicit capture option.
why_now:
  - Typed Farplane file events are now available, and operators need a web
    control surface to install, configure, and verify them.
problems:
  - before: Hook config feels like a raw telemetry aside.
    after: Hook config sits beside the timeline events it produces.
    why_now: Ticket scoring and event-program routing need reliable operator
      proof that a project emits the expected events.
first_principles_basis:
  objective: make project event capture inspectable and configurable
  need: operators must see hook state, recent events, and future program routes
  assumptions: Convex remains the realtime event sink for this slice
  root_cause: raw telemetry exposes rows but not the project capture workflow
  constraints: no browser localStorage for durable config; no hidden daemon
  first_viable_slice: per-project hook control center inside Timeline
  proof_or_falsification: save config, run focused tests, and verify UI render
  tradeoff: Programs tab is a non-executing cockpit placeholder for now
  non_goals: job scheduling, ticket scoring, external kanban webhooks
```

## Change Plan

### Change 1: Goal-backed Timeline surface

```text
fixes:
  - Make hook config discoverable from the event timeline instead of raw setup.
before:
  - RawTelemetryPanel is titled Raw Telemetry and has Events, Distribution,
    Hooks.
after:
  - The panel reads as Project Timeline and offers Events, Hooks, Programs, Raw,
    Distribution.
read:
  - path: ui/src/modules/hook-telemetry/raw-telemetry-panel.tsx
    reason: current operator surface and Convex query owner.
write:
  - path: ui/src/modules/hook-telemetry/raw-telemetry-panel.tsx
    change: retitle, retab, and pass recent telemetry rows to new panels.
  - path: ui/src/modules/hook-telemetry/timeline-hook-panels.tsx
    change: add Hooks and Programs UI components.
operation:
  - Keep Convex query and filters in the route-level panel.
  - Render hooks with list/detail, config form, active patterns, and recent
    events from the current telemetry window.
signature_or_type_impact:
  - Export browser-safe hook telemetry row and explorer types.
routes:
  docs: update_docs
  qa: tests + browser smoke
  review: inline
qa:
  - Typecheck confirms the split components compile.
  - Browser smoke opens the Timeline panel and captures evidence.
failure_modes:
  - Panel gets too dense; use split list/detail and compact previews.
```

### Change 2: summary toggle in runtime config

```text
fixes:
  - Make "Generate summary bubbles" a real project config option.
before:
  - File-change hook summary generation is coupled to hook enabled state.
after:
  - `summaryEnabled` controls legacy `file.change.summary` telemetry while
    typed `farplane.*` events still publish.
read:
  - path: hooks/shared/project-hook-config.ts
    reason: runtime config parser used by file-change hook.
  - path: hooks/file-change-listener/run.ts
    reason: hook entrypoint that decides which candidates to publish.
  - path: ui/vite.config.ts
    reason: local bridge config normalizer.
write:
  - path: hooks/shared/project-hook-config.ts
    change: add `summaryEnabled` with true default.
  - path: hooks/file-change-listener/run.ts
    change: skip summary parse/publish when disabled.
  - path: ui/vite.config.ts
    change: persist and return `summaryEnabled`.
operation:
  - Preserve backwards compatibility by defaulting missing config to true.
signature_or_type_impact:
  - `ProjectHookConfig.summaryEnabled: boolean`
routes:
  docs: update_docs
  qa: tests
  review: inline
qa:
  - Unit test proves summaryEnabled round-trips from project config.
failure_modes:
  - Existing config lacks field; default true avoids silent behavior change.
```

### Change 3: docs and proof

```text
fixes:
  - Keep the module registry and QA runbook aligned with the new Timeline UI.
before:
  - Docs describe Raw Telemetry and basic hooks setup.
after:
  - Docs describe Project Timeline, Hooks, Programs, Raw, and summary toggle.
read:
  - path: ui/src/modules/hook-telemetry/docs/feature-registry.md
    reason: module capability registry.
  - path: ui/src/modules/hook-telemetry/docs/qa-runbook.md
    reason: browser proof path.
write:
  - path: ui/src/modules/hook-telemetry/docs/feature-registry.md
    change: update capabilities.
  - path: ui/src/modules/hook-telemetry/docs/qa-runbook.md
    change: update checks.
operation:
  - Run focused hook config/listener tests and root typecheck.
  - Run browser smoke when the dev server is available.
signature_or_type_impact:
  - none
routes:
  docs: update_docs
  qa: tests + visual smoke
  review: inline
qa:
  - `npm run test:once -- hooks/shared/project-hook-config.test.ts hooks/file-change-listener/handler.test.ts`
  - `npm run typecheck:root`
  - UI smoke screenshot of Timeline/Hooks.
failure_modes:
  - Full UI typecheck may have unrelated debt; report if blocked.
```

## Done

```text
done_when:
  - [x] Timeline panel exposes Events, Hooks, Programs, Raw, and Distribution.
  - [x] Hooks tab supports per-project config save/install and summary toggle.
  - [x] File-change hook respects summaryEnabled without disabling typed events.
  - [x] Event Programs tab clearly previews future routing without executing jobs.
  - [x] Docs, tests, and evidence are linked from this ticket.
```

## QA Strategy

```text
qa_strategy:
  proof_weight: visual_qa + tests
  checks:
    - focused hook config and file-change listener tests
    - root typecheck
  manual:
    - open Project Timeline
    - verify Events and Raw rows render
    - verify Hooks list/detail, summary toggle, active patterns, and preview
    - verify Programs placeholder renders beside timeline ownership
  delegated_lanes:
    - none for first pass; browser screenshot is required before closeout
  review:
    - rubric: inline maintainability and ownership review
      required_tas: none
  evidence:
    - tickets/TASK-0031/artifacts/timeline-hooks.png
    - tickets/TASK-0031/artifacts/timeline-programs.png
  goal_advisor_inputs:
    proof_route: implementer runs focused tests and browser smoke; self-certifies mechanical checks only
    final_evidence: include best screenshot path or block with missing screenshot proof
    final_checkpoint: update ticket and progress before stop_complete
  residual_risk:
    - Event Programs is intentionally non-executing in this slice.
    - Full `npm run typecheck` remains blocked by existing unrelated UI workspace debt; no reported errors referenced hook-telemetry files after filtering.
```

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - ui/src/modules/hook-telemetry/docs/feature-registry.md
    - ui/src/modules/hook-telemetry/docs/qa-runbook.md
    - ui/src/modules/hook-telemetry/README.md
  no_docs_reason:
  validation:
    - docs mention Timeline ownership and summary toggle semantics
```

## Agent Contract

- Open: `npm run ui`, then open the Hook Telemetry / Project Timeline panel.
- Test hook: save `.farplane/hooks/config.json` through the UI or local bridge;
  optional install uses `npm run hooks:install`.
- Stabilize: use existing Convex telemetry rows or empty states; do not mutate
  real ticket frontmatter unless explicitly smoke-testing the hook.
- Inspect: tab labels `Events`, `Hooks`, `Programs`, `Raw`, `Distribution`;
  hook detail should show `File Change Listener`.
- Key screens/states: no events, recent events, hook enabled, summary disabled,
  manifest paths, custom patterns, Programs placeholder.
- Design baseline: use the ASCII layout from the parent thread and compact
  project-dashboard density.
- QA cookbook: `ui/src/modules/hook-telemetry/docs/qa-runbook.md`.
- Taste refs: `docs/TASTE.md` for dense operator surfaces.
- Expected artifacts: screenshot of the Hooks tab and command/test output.

## Run Hints

- Likely size: normal
- Goal recommendation: required
- Budget hint: one focused implementation window; no spend
- Compute hint: local_shared
- Planning hint: light
- QA source: QA Strategy
- Batchability: single-ticket
- Batch reason: one UI module plus hook config runtime boundary
- Human inputs/assets: none
- Credentials / external access: Convex only for live telemetry rows

## Notes

- The Timeline UI was split across module-local components so new source files
  stay under the 500-line pre-commit smell threshold.
