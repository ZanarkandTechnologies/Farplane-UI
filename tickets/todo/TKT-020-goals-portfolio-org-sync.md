# TKT-020: Team Goal Portfolio And Org Rollup

## Status

- state: `todo`
- owner: Farplane UI
- assignee:
- dependencies: TKT-013, TKT-014, TKT-015, TKT-016
- location: `tickets/todo/TKT-020-goals-portfolio-org-sync.md`
- enter when: telemetry, skill, eval, and memory signals can inform team autonomy
- leave when: each team table has a goal portfolio and the global launcher has a cross-team rollup
- blockers: native Goal state has multiple sources and should be linked before rewritten
- spawned follow-ups:
- complexity: `L`

## Description

Create `ui/src/modules/goals` for team-level autonomous goal portfolios, plus a
global cross-team rollup. The Team Panel is the primary scoped entrypoint: each
team table should show the roadmap, event timeline, goals, active projects,
KPIs, current phase/quarter targets, next phase plan, active work, project
files, telemetry, skills, evals, memory, and next autonomous action.

## Scope

- Directory: `ui/src/modules/goals`.
- Global view: cross-team goal rollup, drift, blockers, and company-level goal comparison.
- Team view: the team's autonomous operating portfolio: roadmap, event
  timeline, local goals, active projects, KPIs, current phase/quarter targets,
  next phase plan, active tickets, native Goal packets, telemetry, required
  skills, eval status, memory signals, project files, and next actions.
- Source data: company/project sidecar, tickets, Goal packets, telemetry,
  skills/evals/learning modules.

## UI Sketch

```text
Goals Portfolio
+ Team Goal + Next Action + Blockers + Autonomy Health +
Team Panel: roadmap | events | active projects | KPIs | targets | next phase
Tabs: goal | tickets | files | telemetry | skills | evals | memory
Global radio dial: cross-team rollup | drift | blocked goals | company map
```

## Agent Contract

- Open: Team Panel Goals tab for scoped work; global radio dial for rollup.
- Test hook: goal portfolio normalizer fixture.
- Stabilize: fixture company projects, tickets, and goal packet links.
- Inspect: goal health badges, org/team links, evidence references.
- Key screens/states: team goal portfolio, roadmap, event timeline, active projects/KPIs, project files/docs links, global rollup.
- QA cookbook: `qa/README.md`.
- Taste refs: executive operations dashboard, not a kanban duplicate.
- Expected artifacts: screenshot and normalizer test output.
- Delegate with: this ticket and FP01.

## Done / Proof

- [ ] Goals module exists with team-scoped portfolio view as the primary surface.
- [ ] Global launcher exposes a cross-team rollup without replacing team portfolios.
- [ ] Team/project scoped goal view links to work, active projects, project files, telemetry, skills, evals, and memory where available.
- [ ] Org chart/project mapping is visible.
- [ ] Native Goal packets are linked when discoverable, not blindly rewritten.
- [ ] Normalizer tests pass.
