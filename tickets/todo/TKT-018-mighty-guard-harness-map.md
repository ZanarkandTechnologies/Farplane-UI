# TKT-018: Mighty Guard Harness Map

## Status

- state: `todo`
- owner: Farplane UI
- assignee:
- dependencies: TKT-014, TKT-015, TKT-016
- location: `tickets/todo/TKT-018-mighty-guard-harness-map.md`
- enter when: skills/evals/memory surfaces expose enough health signals
- leave when: Mighty Guard has a clarified advisory healthcheck slice and does not overclaim enforcement
- blockers:
- spawned follow-ups:
- complexity: `L`

## Description

Clarify `ui/src/modules/mighty-guard` as an advisory healthcheck surface for
Farplane's operating harness. The exact product role is still fuzzy, so the
first implementation should stay small: findings, proof gaps, and suggested
actions, not an enforcement layer.

## Scope

- Directory: `ui/src/modules/mighty-guard`.
- Global view: harness map, health findings, maintenance queue.
- Team view: project/team-specific risk findings and missing proof.
- Source data: specs, tickets, skill registry, evals, QA artifacts, lessons/troubles.
- Non-goal: no automatic repair in the first slice.

## UI Sketch

```text
Mighty Guard
+ Critical + Warnings + Stale + Missing Proof +
Advisory Queue: finding | owner | evidence | suggested action
Optional Map: Specs -> Tickets -> Skills -> Evals -> QA -> Modules
Team view: local risks + blockers + proof gaps
```

## Agent Contract

- Open: global launcher; linked from Skills/Evals/Learning.
- Test hook: fixture health-rule tests.
- Stabilize: fixture a small harness graph with pass/warn/fail nodes.
- Inspect: graph/list findings, severity badges, evidence links.
- Key screens/states: advisory queue, optional harness map, team risk detail.
- QA cookbook: `qa/README.md`.
- Taste refs: control-room health UI, not a generic graph demo.
- Expected artifacts: screenshot plus health-rule test output.
- Delegate with: this ticket and FP01.

## Done / Proof

- [ ] Mighty Guard module exists with global launcher entry.
- [ ] Advisory findings render from static/local source relationships.
- [ ] Findings are advisory and evidence-linked.
- [ ] Team/project risk view exists.
- [ ] Health-rule tests pass.
