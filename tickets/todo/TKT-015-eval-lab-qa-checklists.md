# TKT-015: Eval Lab And QA Checklist Surfaces

## Status

- state: `todo`
- owner: Farplane UI
- assignee:
- dependencies: TKT-014
- location: `tickets/todo/TKT-015-eval-lab-qa-checklists.md`
- enter when: existing eval/QA UI needs to be brought into Farplane style
- leave when: eval runs, QA checklists, and evidence links reuse the existing UI pattern as a first-party module
- blockers:
- spawned follow-ups:
- complexity: `M`

## Description

Lift the existing eval and QA UI into `ui/src/modules/evals`. This module makes
proof status visible across skills, tickets, modules, and teams without
inventing a second evaluation experience.

## Scope

- Directory: `ui/src/modules/evals`.
- Global view: eval suites, recent runs, pass/fail drift, missing proof.
- Team view: eval/QA evidence related to that team's skills, goals, and workflows.
- Source data: eval artifacts, ticket QA artifacts, skill tests, `qa/` cookbook status.

## UI Sketch

```text
Eval Lab
+ Passing + Failing + Missing Proof + Stale Runs +
Existing eval UI | QA checklist board | Runs timeline | Evidence drawer
Team view: skill proof | workflow proof | hardcases
```

## Agent Contract

- Open: global launcher entry; linked from Skills and Mighty Guard.
- Test hook: normalizer test over fixture eval artifacts and ticket QA files.
- Stabilize: fixture pass/fail/missing eval rows.
- Inspect: suite rows, run status badges, evidence links.
- Key screens/states: global eval dashboard, checklist detail, team scoped proof.
- QA cookbook: `qa/README.md`.
- Taste refs: existing eval/QA UI adapted to Farplane shadcn style.
- Expected artifacts: screenshot and normalizer test output.
- Delegate with: this ticket and FP01.

## Done / Proof

- [ ] Eval Lab module exists with global entrypoint and reuses the existing eval/QA UI where practical.
- [ ] Eval suites/runs/checklists render from real or fixture-backed local sources.
- [ ] Missing proof is visible and actionable.
- [ ] Team scope filters evidence by project/team where possible.
- [ ] Normalizer tests pass.
