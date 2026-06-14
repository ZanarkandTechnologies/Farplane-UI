---
id: TKT-023
title: Skill OS, Evals, and Harness entrypoint redesign
state: review
owner: Farplane UI
assignee: Codex
created_at: 2026-06-13
complexity: L
---

# TKT-023: Skill OS, Evals, and Harness Entrypoint Redesign

## Status

- state: `review`
- owner: Farplane UI
- assignee: Codex
- dependencies: TKT-022 corrections, Skill Studio bridge, Codex/OpenClaw adapter capability split
- location: `tickets/building/TKT-023-skill-os-evals-harness-redesign`
- enter when: operator clarified the corrected product model for global skills, evals, and harness surfaces
- leave when: UI implements the three global entrypoints with screenshot-backed proof
- blockers: none known
- spawned follow-ups: none yet
- complexity: `L`

## Description

Redesign the skill-related UI around three global radio-dial entrypoints:
`Skill OS`, `Evals`, and `Harness`. In Codex adapter mode, hide employee radial
skill actions because Codex does not equip skills per employee. Preserve
OpenClaw per-agent skill equip behavior behind adapter capability flags.

`Skill OS` is a git/control-plane viewer for skills: skill-to-skill calls,
registry rows, template versions, features, rollouts, audits, and special files
inside each skill folder. `Evals` is a separate global eval operations surface
for run history and suite-level status, while still allowing a selected skill to
show its local `eval_task.json`. `Harness` is a separate global entrypoint for
full harness graph data across skills, docs, agents, templates, and validators.

## Goal

Make the global skill management experience coherent and provable: Skill OS
manages skills, Evals manages eval runs, and Harness manages the larger harness
map. The implementation must be tested with screenshots, not only compile
checks.

## Correct Product Model

- Global radio dial exposes three entries:
  - `Skill OS`
  - `Evals`
  - `Harness`
- Codex adapter mode:
  - hides employee radial `Skills` button
  - treats skills as project/global packages, not per-agent equipment
- OpenClaw adapter mode:
  - may keep employee skill equip controls
  - must declare the capability through adapter config
- `Skill OS` graph:
  - shows only skill-to-skill call/routing/backlink edges
  - examples: frontmatter route fields, common route fields, Markdown references
    that target another skill
  - does not show docs/files/harness-wide nodes
- `Harness` graph:
  - may reuse the same graph rendering engine
  - fetches a different data source and edge set
  - includes docs/files/agents/templates/validators later
- `Evals`:
  - separate global entrypoint for run history, suites, hardcases, artifacts
  - skill-local eval files still render inside the selected Skill OS skill
    viewer

## Acceptance Criteria

- [x] AC-1: Adapter capability config exists and gates UI affordances by
  runtime adapter.
- [x] AC-2: In Codex adapter mode, employee radial controls no longer show the
  skill button/action.
- [x] AC-3: Global radio/settings entrypoints expose `Skill OS`, `Evals`, and
  `Harness` as distinct surfaces.
- [x] AC-4: `Skill OS` renders a skills list, skill-to-skill graph, registry /
  template / rollout summary, and selected skill inspector.
- [x] AC-5: The selected skill inspector renders special skill files nicely:
  `SKILL.md`, frontmatter, todo list, `eval_task.json`, `qa_checklist.md`,
  `references/*`, `audits/*`, and raw files fallback.
- [x] AC-6: `Skill OS` graph edges are skill-to-skill only; harness-wide docs /
  files / agents are not mixed into this graph.
- [x] AC-7: Global `Evals` entrypoint renders eval run/suite status and can
  filter or deep-link by skill.
- [x] AC-8: `Harness` entrypoint renders or shells the harness map separately
  using the shared graph-rendering direction and correct data boundary.
- [x] AC-9: UI matches the current Farplane/shadcn dark office style and avoids
  embedding mismatched legacy graph chrome as the final experience.
- [x] AC-10: Browser screenshot evidence proves the main states work.

## Agent Contract

- Open:
  - `ui/src/components/hud/office-menu.tsx`
  - `ui/src/modules/office/components/employee/index.tsx`
  - `ui/src/modules/office/components/skills-panel.tsx`
  - `ui/src/modules/office/components/skills-panel-sidebar.tsx`
  - `ui/src/modules/office/components/use-skills-panel-controller.ts`
  - `ui/skill-studio-state.ts`
  - `ui/vite.config.ts`
  - nearest module README/AGENTS files before edits
- Test hook:
  - direct endpoint smoke for skill catalog and selected skill detail
  - component/helper unit tests where helpers change
  - browser screenshots via Playwright or `agent-browser`
- Stabilize:
  - keep OpenClaw equip logic intact behind capability checks
  - keep Codex browser path read-first unless a write path is explicit
  - avoid iframe-only final UI for Skill OS; port/reuse the graph rendering
    direction in theme-compatible React where needed
- Inspect:
  - `~/.codex/skills/skill-maintenance/graph/skill-graph.json`
  - `~/.codex/skills/skill-maintenance/graph/harness-graph.json`
  - skill-local `eval_task.json`, `qa_checklist.md`, `audits/*`, `references/*`
- Key screens/states:
  - Codex employee radial without skill button
  - global radio/settings with `Skill OS`, `Evals`, `Harness`
  - Skill OS overview
  - Skill OS graph with skill-to-skill edges
  - selected skill detail showing special files
  - selected skill local eval view
  - global Evals overview
  - Harness map entrypoint
- Taste refs:
  - current Farplane office dark panel style
  - shadcn controls and restrained dense operational layout
  - graph renderer can reuse existing data/layout ideas, but final chrome must
    feel native to Farplane UI
- Expected artifacts:
  - screenshots under this ticket's `artifacts/` folder
  - short QA report with screenshot paths and observed states
  - progress log entries per material pass
- Delegate with:
  - a bounded UI implementation task and a separate visual QA task if using
    subagents

## Evidence Checklist

- [x] Screenshot: Codex employee radial with skill action hidden
- [x] Screenshot: global radio/settings showing `Skill OS`, `Evals`, `Harness`
- [x] Screenshot: Skill OS overview/registry
- [x] Screenshot: Skill OS skill-to-skill graph
- [x] Screenshot: selected skill `SKILL.md` rendered by sections
- [x] Screenshot: selected skill `eval_task.json` rendered in Skill OS
- [x] Screenshot: global Evals entrypoint
- [x] Screenshot: Harness entrypoint
- [x] Snapshot/log: `/openclaw/skills/catalog` or successor endpoint returns real
  skill packages
- [x] QA report linked

## Build Notes

- Start by fixing architecture labels and adapter capability config before
  deeper UI.
- Prefer one reusable graph renderer contract:
  `GraphView(data, edgeKinds, nodeKinds, filters)`.
- Use different data loaders for `Skill OS` and `Harness`.
- Keep skill-local eval rendering in Skill OS; global eval run history belongs
  in `Evals`.

## QA Reconciliation

- AC-1: `PASS` adapter capabilities added for Codex/OpenClaw.
- AC-2: `PASS` `employee-radial-codex-no-skills.png` shows Chat/Manage/Context
  radial controls and no Skills action; `employee-radial-state.json` confirms
  `skills: false`.
- AC-3: `PASS` `global-speed-dial-entrypoints.png` shows `Skill OS`, `Evals`,
  and `Harness`.
- AC-4: `PASS` `skill-os-overview.png` and `skill-os-graph.png`.
- AC-5: `PASS` `skill-os-skill-md.png` and `skill-os-eval-file.png`.
- AC-6: `PASS` `endpoint-snapshot.json` shows skill graph counts separate from
  harness graph counts.
- AC-7: `PASS` `evals-entrypoint.png`.
- AC-8: `PASS` `harness-entrypoint.png`.
- AC-9: `PASS` visual proof uses Farplane dark panel chrome and native cards/SVG.
- AC-10: `PASS` screenshot set captured under the QA artifact folder.
- Screen: `PASS`
- Evidence item: `PASS`

## Artifact Links

- Goal program: `tickets/building/TKT-023-skill-os-evals-harness-redesign/program.md`
- Goal progress: `tickets/building/TKT-023-skill-os-evals-harness-redesign/progress.md`
- Generated Goal prompt: `tickets/building/TKT-023-skill-os-evals-harness-redesign/generated-goal-prompt.md`
- QA report: `tickets/building/TKT-023-skill-os-evals-harness-redesign/artifacts/qa-2026-06-13-skill-os/qa-report.md`
- Screenshot folder: `tickets/building/TKT-023-skill-os-evals-harness-redesign/artifacts/qa-2026-06-13-skill-os/`

## User Evidence

- Hero screenshot: `artifacts/qa-2026-06-13-skill-os/skill-os-overview.png`
- Supporting evidence: `global-speed-dial-entrypoints.png`,
  `employee-radial-codex-no-skills.png`, `skill-os-graph.png`,
  `skill-os-skill-md.png`, `skill-os-eval-file.png`, `evals-entrypoint.png`,
  `harness-entrypoint.png`, `endpoint-snapshot.json`,
  `browser-console-clean-run.log`
- QA report: `artifacts/qa-2026-06-13-skill-os/qa-report.md`
- Final verdict: `pass-ready`

## Required Evidence

- [x] Focused lint passes
- [x] Focused tests pass
- [x] Filtered typecheck shows no touched-file errors, or full typecheck passes
- [x] Browser screenshots prove all key UI states
- [x] QA report reconciles screenshots against acceptance criteria
