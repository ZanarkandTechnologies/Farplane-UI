# TKT-016: Learning Inbox And Memory Renderer

## Status

- state: `todo`
- owner: Farplane UI
- assignee:
- dependencies: TKT-012
- location: `tickets/todo/TKT-016-learning-inbox-memory-renderer.md`
- enter when: project memory files exist but are rendered as plain snippets
- leave when: docs/memory files have polished Markdown rendering plus a decision/history graph where available
- blockers:
- spawned follow-ups:
- complexity: `M`

## Description

Create a proper docs/memory renderer around project memory files and
hook-generated learning signals. The UI should make raw trouble, distilled
lessons, durable memory, history, and decision reasoning navigable.

## Scope

- Directory: prefer `ui/src/modules/lessons`; reuse or fold
  `ui/src/modules/self-improvement` if simpler.
- Global view: cross-project learning inbox and memory index.
- Team view: active project's literal files, especially `docs/MEMORY.md`,
  `docs/LESSONS.md`, `docs/TROUBLES.md`, and `docs/HISTORY.md`.
- Source data: project files discovered from active project tracking context.

## UI Sketch

```text
Learning
+ New Lessons + Open Troubles + Promoted Memory + Recent History +
Tabs: Files | Lessons | Troubles | Memory | History | Decisions
Right: rendered Markdown + source file + decision graph where available
Team view: same tabs scoped to one project
```

## Agent Contract

- Open: global Learning launcher; Team Panel Memory/Learning tab.
- Test hook: markdown parser tests and state-bridge route fixture.
- Stabilize: fixture deep-init docs with sections and dated rows.
- Inspect: rendered Markdown, section headings, source file badges, decision graph, empty states.
- Key screens/states: global index, team memory, missing file state.
- QA cookbook: `qa/README.md`.
- Taste refs: readable docs viewer, not raw textarea.
- Expected artifacts: screenshot of team memory and global learning inbox.
- Delegate with: this ticket and FP01.

## Done / Proof

- [ ] Project memory files render as readable Markdown with section navigation and source badges.
- [ ] `HISTORY.md` / decision-shaped entries can render as a graph of event, decision, reason, and consequence where structure exists.
- [ ] Global learning inbox aggregates visible project memory sources.
- [ ] Missing deep-init files render recovery guidance.
- [ ] Team view stays scoped to active project.
- [ ] Parser tests pass.
