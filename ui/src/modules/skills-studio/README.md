# Skills Studio Module

Owns parsing and serialization helpers for file-backed skill metadata used by Skill Studio UI surfaces.

## Skill OS

Skill OS has two page-level homes plus the existing selected-skill workspace:

- `Capability Map` is the default, full-screen constellation for discovering
  admitted real capabilities. The org view shows the seven departments and
  their direct workstations or system facilities; clicking a department fans
  out that small constellation, then clicking an object opens its details.
  Workstations declare one `produces` artifact ID and optional `consumes` IDs;
  facilities declare the artifact IDs they consume. Department membership comes
  from skill `group`, while Farplane's capability-admission projection selects
  the map. A directed flow appears only when a declared output exactly matches
  a declared input; it is a handoff contract, not an automatic call, delivery,
  or runtime state.
- `Skill Library` owns the technical graph, search, tier/source/edge controls,
  and actionable maintenance filters such as Needs care and Evaluated.
- `Skill workspace` opens an owner skill's Overview, Runbook, conditional
  Experiments, and Files. Returning from a capability handoff restores its
  focused Department.

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
