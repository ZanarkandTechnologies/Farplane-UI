# Skills Studio Module

Owns parsing and serialization helpers for file-backed skill metadata used by Skill Studio UI surfaces.

## Skill OS

Skill OS has two page-level homes plus the existing selected-skill workspace:

- `Capability Map` is the default, full-screen radial map for discovering real
  artifact-producing workflows. It starts with the seven declared operating
  departments, opens their configured real Tier 3 workflow roots, then shows
  each workflow's direct artifact specialists. Department membership comes from
  skill `group`, while the Farplane-owned workflow-root projection selects the
  map; links remain declared membership or artifact containment and never imply
  process order or runtime scheduling. Account integrations and generic helpers
  remain in Skill Library. An artifact inspector exposes its declared output,
  method id, and owner skill.
- `Skill Library` owns the technical graph, search, tier/source/edge controls,
  and actionable maintenance filters such as Needs care and Evaluated.
- `Skill workspace` opens an owner skill's Overview, Runbook, conditional
  Experiments, and Files. Returning from a capability handoff restores its
  focused Department or workflow.

`/skills` defaults to Capability Map. Maintenance entries such as
`/skill-rollout` use Skill Library through their non-default initial filter.

The selected-skill workspace uses an Operations Dossier layout: one compact identity header, a
responsive section rail, and one content scroll owner. Desktop keeps health and the latest
self-improvement learning visible in the rail; narrow layouts collapse that rail into an
overflow-safe section strip without changing URL-backed view state.

Rollout debt, heat, declared tier, and core relevance remain inputs to filters and compact status.
They are not standalone pages because their useful action is opening the affected skill.

Harness OS may link to Skill OS entrypoints, but it should not host skill rollout as a Harness OS tab.

Runbook renders `## Todo List` as Steps, the file declared by frontmatter `qa_checklist` as Quality
checks, and an explicit `## QA Tasks` section only when present. These sources never fall back to
the same global checkbox list.

When a selected skill contains a `self-improve/` directory, Experiments projects the canonical
`program.md` plan and append-only `progress.md` history into a score graph and expandable timeline
alongside its eval suite and run history; it does not introduce a second data model.

## Portable skill evals

Skill registry rows may expose `eval: "evals/evals.json"`, relative to the owning skill package.
Skill Studio loads the strict Agent Skills root `{ skill_name, evals }` and renders each case's
`prompt`, `expected_output`, `files`, `assertions`, and optional `metadata.farplane` values.
Global Eval OS run tasks remain a separate runner-native artifact family.
