---
id: TKT-031
title: Skill OS workbench tabs and invocation counters
state: building
owner: Farplane UI
assignee: Codex
created_at: 2026-06-14
complexity: M
depends_on:
  - TKT-025
  - TKT-029
  - TKT-030
---

# TKT-031: Skill OS Workbench Tabs and Invocation Counters

## Status

- state: `review`
- owner: Farplane UI
- assignee: Codex
- dependencies:
  - `TKT-025` skill invocation hook/dashboard owns the telemetry source
  - `TKT-029` graph-first Skill OS owns the primary graph shell
  - `TKT-030` graph performance owns renderer/lazy/fallback behavior
- location: `tickets/building/TKT-031-skill-os-workbench-invocations`
- enter when: operator wants Skill OS to grow beyond the graph into a usable
  skill workbench with special-file tabs and invocation counters
- leave when: Skill OS has top-level tabs for tree/invocations/standards, a
  full-page skill workbench with special-file renderers, and browser proof
- blockers: none known

## Goal

Extend Skill OS without redesigning the graph renderer:

- Keep `Skill Tree` as the graph-first entrypoint.
- Add `Invocations` as a Skill OS tab that reuses TKT-025 telemetry data.
- Add `Standards / Rollout` as a Skill OS tab for template/version drift.
- Upgrade the selected-skill full-page view into a workbench with tabs for
  special skill files and extracted sections.
- Add a skill-folder file graph for the selected skill where file nodes open a
  viewer, and known files get richer renderers.

## Non-Goals

- Do not fix or replace Reagraph in this ticket.
- Do not add a second skill invocation hook/backend.
- Do not move eval/harness global entrypoints back into Skill OS.
- Do not implement editing or writes to skill files.
- Do not require Convex for the Skill Tree tab to function.

## Product Sketch

```text
Skill OS
+--------------------------------------------------------------------------+
| Tabs: Skill Tree | Invocations | Standards / Rollout                     |
+--------------------------------------------------------------------------+

Skill Tree
+----------------------+---------------------------------------------------+
| Search / filters     | Big skill dependency graph                        |
| Skill cards + counts | click node/card opens detail overlay              |
+----------------------+---------------------------------------------------+

Selected Skill Full Page
+--------------------------------------------------------------------------+
| prototyping        T1 local        invoked 12x       [Back to graph]      |
+--------------------------------------------------------------------------+
| Tabs: Overview | Todo | QA Tasks | Checklist | References | File Graph   |
|       Evals | UI | Raw Files                                             |
+--------------------------------------------------------------------------+
| File graph / special renderer / markdown or code viewer                   |
+--------------------------------------------------------------------------+
```

## Data Contract

- Skill catalog:
  - `skill-graph.json` and `skill-docs.json` stay the graph/doc source.
  - `SkillDoc.body` is parsed into lightweight sections client-side.
- Invocation data:
  - reuse `api.modules.skillInvocations.queries.getSkillInvocationDashboard`
    when Convex is configured
  - map `bySkill[].key` or display name to graph node ids
  - render `0` or unavailable states when Convex is not enabled
- File graph:
  - first pass can derive known virtual file nodes from embedded docs:
    `SKILL.md`, `frontmatter`, `todo`, `qa-tasks`, `checklist`, `references`,
    `evals`, `ui`, `raw`
  - future pass can hydrate actual sibling files through the Codex app server

## Implementation Plan

1. Add Skill OS top-level tabs.
   - `Skill Tree`: existing graph/sidebar/detail.
   - `Invocations`: compact usage dashboard embedded in Skill OS.
   - `Standards / Rollout`: template/version summary from skill frontmatter.
2. Add a Skill OS invocation adapter.
   - Load the existing Convex dashboard query only when Convex is available.
   - Expose count lookup by skill id.
   - Show count badges in sidebar cards and selected-skill stats.
3. Upgrade full-page selected-skill workbench.
   - Keep overlay as fast preview.
   - `Open full page` expands to a tabbed workbench, not just the long overview.
   - Extract sections from `SKILL.md`: todo list, QA task-like sections,
     checklist-like sections, references, eval mentions, UI mentions.
4. Add selected-skill file graph and viewer.
   - Render virtual nodes for known skill artifacts.
   - Clicking a file node switches the viewer to the corresponding renderer.
5. QA.
   - Screenshot Skill Tree with invocation badges.
   - Screenshot Invocations tab.
   - Screenshot Standards / Rollout tab.
   - Screenshot full-page workbench with special-file tabs and file graph.

## Done / Proof

- [x] Skill OS top-level tabs exist: `Skill Tree`, `Invocations`,
  `Standards / Rollout`.
- [x] Skill Tree keeps the existing graph-first layout.
- [x] Sidebar and selected skill stats show invocation counts when telemetry is
  available, and a sane unavailable/zero state otherwise.
- [x] `Invocations` tab reuses the existing invocation dashboard/query surface.
- [x] `Standards / Rollout` summarizes template/version/tier/source rollout
  state from skill frontmatter.
- [x] Full-page selected skill opens a tabbed workbench.
- [x] Workbench tabs include Overview, Todo, QA Tasks, Checklist, References,
  File Graph, Evals, UI, and Raw Files.
- [x] File Graph shows selected skill artifacts and opens a viewer on click.
- [x] Browser screenshots prove the main states.
- [x] Focused formatter/tests pass, with known workspace typecheck drift
  documented if it remains.

## Files

- `ui/src/modules/skills-studio/components/skill-os/*`
- `ui/src/modules/skill-invocations/*`
- `tickets/building/TKT-031-skill-os-workbench-invocations/*`
