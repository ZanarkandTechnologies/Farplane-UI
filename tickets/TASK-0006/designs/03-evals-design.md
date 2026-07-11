---
title: "Evals Panel Design"
ticket_id: TASK-0006
status: draft
owner: farplane-ui
created_at: 2026-06-24
updated_at: 2026-06-24
kind: design
refs:
  - ../../TASK-0006/ticket.md
  - ../../../ui/src/modules/evals/
  - /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/farplane-framework/harness-maintenance.md
---

# Evals Panel Design

## User Stories

- As an operator, I want to know whether harness behavior is proven.
- As a maintainer, I want to inspect failing evals and the artifacts behind
  them.
- As a builder, I want to see which skills or prompts lack eval coverage.

## Data Sources

```text
eval tasks:
  skills/*/evals/evals.json
  eval templates and examples

eval runs:
  local eval run artifacts and reports
  python3 skills/eval/scripts/run_evals.py
```

## Panel Shell

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ EVALS                                                   last run 10 min ago  │
│ Behavior proof for skills, prompts, and harness workflows.       [Run Evals] │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Runs] [Tasks] [Health] [Artifacts]                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Runs Tab

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ EVALS / RUNS                                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Recent] [Failures] [By Skill] [Queued]                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ Passed 41 │ Failed 3 │ Skipped 0 │ Duration 4m12s │ Artifacts 44             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Run ID        Scope              Result   Started       Duration             │
│ run-1024      skill-maintenance  fail     10:20         1m02s                │
│ run-1023      functional-ui      pass     09:40         0m29s                │
│ run-1022      harness-advisor    pass     yesterday     0m47s                │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ FAILURE SUMMARY                      │ SELECTED RUN                          │
│ skill-maintenance: 2                 │ run-1024                               │
│ eval: 1                              │ failed judges: rubric_match            │
│                                      │ artifacts: report.md, trace.json       │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

## Tasks Tab

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ EVALS / TASKS                                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ [All] [By Skill] [No Recent Run] [Missing Coverage]                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Task                 Skill              Judge           Last Result          │
│ ui-hierarchy         functional-ui      rubric          pass                 │
│ skill-contract       skill-maintenance  boolean         fail                 │
│ missing-eval         harness-advisor    none            no coverage          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Health Tab

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ EVALS / HEALTH                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Coverage] [Flake] [Failures] [Trends]                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Coverage by surface                                                          │
│ Skills with evals       43 / 97                                              │
│ Harness prompts covered 12 / 20                                              │
│ Recent pass rate        93%                                                  │
│ Repeated failures       2                                                    │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ COVERAGE GAPS                        │ NEXT ACTION                           │
│ harness-rollout                      │ create eval task                       │
│ graph-projection-dispatcher          │ add stale-output fixture               │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

## Artifacts Tab

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ EVALS / ARTIFACTS                                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Reports] [Traces] [Judge Output] [Snapshots]                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ Artifact             Run        Type        Size       Open                  │
│ report.md            run-1024   report      9 KB       view                  │
│ trace.json           run-1024   trace       42 KB      view                  │
│ judge-output.json    run-1024   judge       12 KB      view                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Interaction Rules

- `Run Evals` should be disabled or confirmation-gated until command scope is
  selected.
- v1 can be read-only if executing evals from UI is too much for the first
  build Goal.
- Failed evals should cross-link back to Skills when the failing target is a
  skill.
- Harness Health can show eval summary but should deep-link here for details.
