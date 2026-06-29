---
title: "Build Roadmap"
ticket_id: TASK-0006
status: draft
owner: farplane-ui
created_at: 2026-06-24
updated_at: 2026-06-24
kind: roadmap
refs:
  - ../../TASK-0006/ticket.md
  - 00-hierarchy-design.md
  - 01-harness-design.md
  - 02-skills-design.md
  - 03-evals-design.md
  - 04-launcher-design.md
---

# Build Roadmap

## Recommended Build Order

### Slice 1: Navigation And Harness Restructure

Goal:

```text
existing Harness OS -> Harness panel with Health, Map, Rollout tabs
```

Build:

- Keep current lifecycle cockpit under `Harness > Map > Lifecycle`.
- Add `Harness > Health > Overview` using available generated artifacts and
  placeholder check rows where no endpoint exists yet.
- Add `Harness > Rollout` shell with empty/loading/error states.
- Preserve current Graph and Feature Registry views under `Map`.

Proof:

- `/harness-os` renders Health, Map, Rollout.
- Existing lifecycle screenshot still works under Map.
- No horizontal overflow desktop/mobile.
- `npm run ui:build`.

### Slice 2: Project Adoption Rollout

Goal:

```text
Harness > Rollout reads adoption scan JSON and renders projects/features/drift
```

Build:

- Add Vite bridge endpoint for `farplane adoption scan --json`.
- Render rollout counts, project table, feature rollout, selected project drawer.
- Add missing roots/command failure states.

Proof:

- Scan current Farplane project and render one project.
- Simulate missing manifest fixture if practical.
- Browser screenshot for Rollout.

### Slice 3: Skill Rollout Upgrade

Goal:

```text
Skills > Rollout becomes the canonical skill-template/template rollout view
```

Build:

- Add/read `farplane skills rollout scan --json`.
- Render current/stale/missing/external skills.
- Cross-link stale rows to `Harness > Health` attention and `Skills > Workbench`.

Proof:

- Render current repo skill rollout.
- Browser screenshot and source-copy QA.

### Slice 4: Evals Panel Refresh

Goal:

```text
Evals becomes a first-class behavior proof panel
```

Build:

- Keep existing eval module where possible.
- Add Runs, Tasks, Health, Artifacts IA.
- Start read-only if eval execution from UI is not ready.

Proof:

- Render existing eval fixtures/artifacts or empty state.
- Cross-link from Skills and Harness Health.

### Slice 5: Checks And Freshness

Goal:

```text
Harness > Health shows validator/check/freshness results
```

Build:

- Add endpoint or generated payload for maintenance command statuses.
- Render pass/fail/stale rows with exact commands and owner surfaces.
- Do not recompute semantics in React.

Proof:

- At least three checks shown: skill registry sync, doc refs, graph projection
  freshness.
- Failure and stale states can be mocked or fixture-backed.

## First Goal Candidate

```text
Goal: Restructure Harness OS into Health / Map / Rollout tabs and preserve the
current lifecycle cockpit under Map.

Done when:
  - Harness opens to Health Overview.
  - Map contains the current lifecycle cockpit and graph views.
  - Rollout has a shell with adoption-scan empty/loading/error states.
  - Desktop/mobile browser proof shows no overlap or horizontal overflow.
  - npm run ui:build passes.
```

## Non-Goals For First Goal

- Running CLI scans from the UI.
- Implementing eval execution.
- Editing registries, manifests, templates, or skills.
- Building historical trends.
- Solving all existing repo-wide TypeScript debt.
