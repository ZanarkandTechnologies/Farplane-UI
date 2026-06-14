# TKT-021: Docs And Farplane Testament Renderer

## Status

- state: `todo`
- owner: Farplane UI
- assignee:
- dependencies: TKT-009
- location: `tickets/todo/TKT-021-docs-bookshelf-testament-renderer.md`
- enter when: Farplane docs are numerous and important but only visible in the filesystem
- leave when: the office can render FP doctrine globally and literal project files/docs inside the Team Panel
- blockers:
- spawned follow-ups:
- complexity: `M`

## Description

Create an in-app documentation renderer for the Farplane harness. It should
render the new `FP` testament docs, legacy `SC` specs, architecture docs, QA
runbooks, public docs, module docs, tickets, and project memory docs in a
searchable operator UI. Scoped project files/docs are entered from the Team
Panel's Files/Docs tab, not separate office furniture.

## Scope

- Directory: `ui/src/modules/bookshelf` or existing docs/files module if one is already present.
- Global view: doctrine library, filters, search, freshness, owners, source paths.
- Team view: project/team relevant docs, each project directory's files,
  deep-init memory docs, active tickets, and linked module docs.
- Source data: `docs/`, `docs/specs/`, `qa/`, `tickets/`,
  `ui/src/modules/*/README.md`, project memory files.
- Non-goal: full markdown editing in the first slice.

## UI Sketch

```text
Docs / Files
+ FP Testament + Legacy SC + Runbooks + QA + Tickets +
Left: shelves/filter tree
Main: rendered markdown/document list
Right: source path + freshness + related modules/tickets
Team Panel: partially expanded project files + rendered Markdown preview
```

## Agent Contract

- Open: global radio dial for all docs; Team Panel Docs/Files tab for scoped project docs.
- Test hook: docs indexer normalizer test over fixture docs.
- Stabilize: fixture docs with FP spec, legacy SC spec, ticket, QA runbook, module README.
- Inspect: shelf labels, rendered markdown headings, source path links.
- Key screens/states: global doctrine library, selected doc render, team-scoped project files/docs, missing source state.
- QA cookbook: `qa/README.md`.
- Taste refs: dense readable Markdown/file viewer; not a marketing docs site.
- Expected artifacts: screenshot and normalizer test output.
- Delegate with: this ticket and FP01.

## Done / Proof

- [ ] Docs module/library exists with global launcher entry.
- [ ] FP docs and legacy SC specs render in distinct shelves.
- [ ] Tickets, QA runbooks, module docs, and project memory files are discoverable.
- [ ] Team/project scope filters docs and project files by active project where possible.
- [ ] Markdown rendering is readable and source paths are visible.
- [ ] Normalizer tests pass.
