---
id: TKT-033
title: Harness OS repo-wide graph entrypoint
state: done
owner: Farplane UI
assignee: Codex
created_at: 2026-06-14
updated_at: 2026-06-14
complexity: M
depends_on:
  - TKT-023
  - TKT-032
---

# TKT-033: Harness OS Repo-Wide Graph Entrypoint

## Status

- state: `done`
- owner: Farplane UI
- assignee: Codex
- location: `tickets/done/TKT-033-harness-os-entrypoint`
- enter when: operator wants Harness OS to be its own global launcher entrypoint
  and to reuse Skill OS graph direction without changing Skill OS behavior
- leave when: Harness OS opens from the launcher, renders a repo-wide generated
  graph, and shows feature registry rows
- blockers: none

## Scope

- In:
  - Keep the existing Skill OS UI behavior intact.
  - Add shared `graph-workbench` primitives for future graph mini apps.
  - Add `harness-os` as a module-local surface.
  - Adapt generated `/codex/skill-maintenance-graph/harness-graph.json` into a
    focused graph of skills, docs, specs, features, agents, scripts, templates,
    review rubrics, and research.
  - Add feature nodes and feature-surface edges from
    `skill-template-intelligence.json`.
  - Render a Feature Registry tab with all generated feature rows.
  - Rename the global launcher label to `Harness OS`.
- Out:
  - Do not migrate Skill OS onto the shared graph workbench in this ticket.
  - Do not add writer controls.
  - Do not mine repository files in the browser.

## Delta

- `Before:` The launcher had a `Harness` item, but the panel content was a
  placeholder count view inside `skills-panel.tsx`.
- `After:` The launcher exposes `Harness OS`, backed by a module-local mini app
  that renders the generated harness graph and Feature Registry.

## Done / Proof

- Files:
  - `ui/src/modules/graph-workbench/*`
  - `ui/src/modules/harness-os/*`
  - `ui/src/modules/office/components/skills-panel.tsx`
  - `ui/src/components/hud/office-panel-registry.ts`
- Verification:
  - `npm run typecheck:root` passed.
  - `git diff --check` passed.
  - Browser QA opened `Harness OS` from the global launcher and captured:
    - `harness-os-graph.png`
    - `harness-os-feature-registry.png`
