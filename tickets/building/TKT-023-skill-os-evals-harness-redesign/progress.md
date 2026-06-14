---
ticket: TKT-023
title: Skill OS, Evals, and Harness redesign progress
status: active
created_at: 2026-06-13
---

# Progress

## 2026-06-13 Goal Packet Created

- trigger: operator requested a ticket and Goal via `goal-advisor`
- intent: implement the corrected Skill OS / Evals / Harness global entrypoint
  model and require screenshot proof
- actions:
  - created TKT-023 packet
  - encoded adapter capability split for Codex versus OpenClaw
  - encoded Skill OS graph boundary as skill-to-skill only
  - separated global `Evals` and `Harness` entrypoints from Skill OS
  - required screenshot evidence for all key UI states
- files/artifacts:
  - `tickets/building/TKT-023-skill-os-evals-harness-redesign/ticket.md`
  - `tickets/building/TKT-023-skill-os-evals-harness-redesign/program.md`
  - `tickets/building/TKT-023-skill-os-evals-harness-redesign/progress.md`
  - `tickets/building/TKT-023-skill-os-evals-harness-redesign/generated-goal-prompt.md`
- metric sample: packet files created; implementation not started
- drift verdict: aligned with latest operator correction
- next_action: launch native Goal and begin implementation
- blockers: none

## 2026-06-13 Implementation And QA

- trigger: Goal execution for TKT-023
- actions:
  - added runtime adapter capability flags for employee skill equip, global
    skill browser, skill eval runs, and harness graph
  - hid employee radial Skills action in Codex adapter mode while keeping
    OpenClaw capability support
  - split global launcher entries into `Skill OS`, `Evals`, and `Harness`
  - redesigned the Skills panel as a surface switcher with Skill OS overview,
    native skill-to-skill graph, Evals surface, and Harness surface
  - upgraded skill file preview for Markdown and JSON special files
  - captured screenshot proof and endpoint snapshots
- files/artifacts:
  - `ui/src/modules/runtime/lib/adapters/contract.ts`
  - `ui/src/modules/runtime/lib/adapters/codex-runtime-adapter.ts`
  - `ui/src/modules/runtime/lib/adapters/openclaw-runtime-adapter.ts`
  - `ui/src/store/app-store.ts`
  - `ui/src/components/hud/office-panel-registry.ts`
  - `ui/src/components/hud/office-menu.tsx`
  - `ui/src/modules/office/components/employee/index.tsx`
  - `ui/src/modules/office/components/skills-panel.tsx`
  - `ui/src/modules/office/components/skills-panel-files-tab.tsx`
  - `tickets/building/TKT-023-skill-os-evals-harness-redesign/artifacts/qa-2026-06-13-skill-os/`
- checks:
  - focused Biome check passed on touched files
  - focused Vitest suite passed: 23 tests
  - filtered UI typecheck reported no touched-file errors
  - Playwright browser proof captured required screenshots with clean final
    console log
- metric sample:
  - skill catalog count: 111
  - Skill OS graph: 86 nodes / 273 edges
  - Harness graph: 665 nodes / 2202 edges
- drift verdict: aligned with corrected product model; Evals and Harness are
  separate global entrypoints, not hidden Skill OS tabs
- next_action: review and optionally polish Harness graph visualization
- blockers: none
