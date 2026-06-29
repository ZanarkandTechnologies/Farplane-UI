---
title: "Skills Panel Design"
ticket_id: TASK-0006
status: draft
owner: farplane-ui
created_at: 2026-06-24
updated_at: 2026-06-24
kind: design
refs:
  - ../../TASK-0006/ticket.md
  - ../../../ui/src/modules/skills-studio/
  - /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/farplane-framework/harness-maintenance.md
---

# Skills Panel Design

## User Stories

- As an operator, I want to inspect available skills quickly.
- As a harness maintainer, I want to see which skills are current, stale,
  missing template metadata, or external.
- As an operator, I want to jump from a skill to its docs, invocations, evals,
  and rollout status.

## Data Sources

```text
skill graph:
  skill-graph.json
  skill-docs.json

rollout:
  python3 bin/farplane.py skills rollout scan --json
  skill-template-intelligence.json rollout fields

invocations:
  existing skill invocation module/counts
```

## Panel Shell

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ SKILLS                                                     97 skills indexed │
│ Inspect skills, template status, docs, chains, and usage.        [Refresh]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Workbench] [Rollout] [Invocations] [Standards]                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Workbench Tab

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ SKILLS / WORKBENCH                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Search skills...                        Tier [1] [2] [3]  Source [local][ext]│
├──────────────────────┬────────────────────────────────────┬─────────────────┤
│ SKILL LIST           │ GRAPH / RELATIONSHIPS              │ SELECTED SKILL  │
│                      │                                    │                 │
│ > functional-ui      │    advise ──> functional-ui        │ functional-ui   │
│   frontend-craft     │       │          │                 │ tier 3 frontend │
│   eval               │       ▼          ▼                 │                 │
│   skill-maintenance  │    visual      frontend-craft      │ Reads           │
│   harness-advisor    │                                    │ SKILL.md        │
│                      │                                    │                 │
│                      │                                    │ Links           │
│                      │                                    │ evals, docs     │
└──────────────────────┴────────────────────────────────────┴─────────────────┘
```

## Rollout Tab

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ SKILLS / ROLLOUT                                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ [All] [Current] [Stale] [Missing] [External]                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ Current 82 │ Stale 12 │ Missing 3 │ External 9 │ Template 0.3.2             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Skill              Status    Template     Owner      Notes                   │
│ functional-ui      current   0.3.2        frontend   ok                      │
│ old-skill          stale     0.2.0        harness    update checklist        │
│ upstream-only      external  -            plugin     no local write          │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ UPDATE CANDIDATES                    │ SELECTED SKILL                        │
│ old-skill                            │ source: skills/old-skill/SKILL.md     │
│ missing-todo                         │ fix: sync_skill_registry / edit skill │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

## Invocations Tab

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ SKILLS / INVOCATIONS                                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Recent] [By Skill] [Failures] [No Usage]                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Skill              Invocations   Last Used       Failure Rate                │
│ functional-ui      14            today           0%                          │
│ eval               3             yesterday       0%                          │
│ unused-skill       0             never           -                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Standards Tab

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ SKILLS / STANDARDS                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Template] [Todo Contract] [Capabilities] [Registry Sync]                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Check                         Status      Command                            │
│ sync_skill_registry           pass        python3 bin/validators/... --check │
│ check_skill_todo_tiers        fail        python3 bin/validators/...         │
│ check_skill_capabilities      pass        python3 bin/validators/...         │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Interaction Rules

- Selecting a skill persists across Workbench, Rollout, Invocations, Standards.
- Rollout rows link to the owning `SKILL.md`.
- Failures should show the validator command and exact owner surface.
- Do not edit skill files in v1; read-only with source links and follow-up
  actions.
