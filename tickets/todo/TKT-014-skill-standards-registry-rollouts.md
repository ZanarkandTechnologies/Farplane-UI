# TKT-014: Skill Standards Registry And Rollouts

## Status

- state: `todo`
- owner: Farplane UI
- assignee:
- dependencies: TKT-009
- location: `tickets/todo/TKT-014-skill-standards-registry-rollouts.md`
- enter when: the existing skills UI and skill-maintenance graph need to live inside Farplane style
- leave when: Skill Studio reuses the existing graph/control-room UI and renders standards, registry state, and rollout state
- blockers:
- spawned follow-ups:
- complexity: `M`

## Description

Lift the existing skills graph/control-room UI, especially the graph UI already
present in the skill-maintenance skill, into `ui/src/modules/skills-studio`.
The module should render skill standards and rollout health: installed state,
source path, frontmatter, checklists, QA status, dependencies, and registry
placement.

## Scope

- Directory: `ui/src/modules/skills-studio`.
- Global view: all skills, filters, standards health, rollout statuses, reused graph.
- Team view: equipped skills, missing recommended skills, readiness and QA state.
- Source data: `skills/`, installed skill roots when available, `skills-lock.json`, skill tests, skill metadata.

## UI Sketch

```text
Skills
+ Standards Score + Installed + Needs QA + Rollout Drift +
Left: registry/graph
Main: skill cards/table
Right: selected skill detail + checklist + rollout notes
Team tab: equipped | recommended | missing | blocked
```

## Agent Contract

- Open: global Skills launcher; Team Panel Skills or Business Skills area when scoped.
- Test hook: skill parser/normalizer unit tests.
- Stabilize: fixture a tiny skill catalog for tests.
- Inspect: DOM list of skill ids, health badges, and selected-skill details.
- Key screens/states: catalog, graph/tree, selected skill detail, team-scoped equipped skills.
- QA cookbook: `qa/README.md`.
- Taste refs: existing skill-maintenance graph adapted to Farplane shadcn style.
- Expected artifacts: screenshot of global registry and team-scoped skill readiness.
- Delegate with: this ticket and FP01.

## Done / Proof

- [ ] Skill catalog renders real repo skills and installed-state placeholders.
- [ ] Standards/QA/rollout health is visible per skill.
- [ ] Existing graph/dependency UI is reused where practical and navigable.
- [ ] Team-scoped skill readiness can be opened from team context.
- [ ] Tests cover normalizer behavior.
