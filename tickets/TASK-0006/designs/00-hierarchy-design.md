---
title: "UI Hierarchy Design"
ticket_id: TASK-0006
status: draft
owner: farplane-ui
created_at: 2026-06-24
updated_at: 2026-06-24
kind: design
refs:
  - ../../TASK-0006/ticket.md
  - ../../../ui/src/modules/skills-studio/
  - ../../../ui/src/modules/evals/
  - ../../../ui/src/modules/harness-os/
---

# UI Hierarchy Design

## Decision

Use three top-level operator panels:

```text
Office Launcher / Horizontal Dial
├─ Skills
├─ Evals
└─ Harness
```

Do not bury `Skills` or `Evals` inside `Harness`. They are daily-use operator
work modes. `Harness` owns maintenance, system map, and rollout health.

## Hierarchy Rules

```text
panel = a durable work mode the operator intentionally opens
tab = a major question within that work mode
group button = a subview/filter within the current question
drawer = details for the selected row/node/state
```

## Proposed Tree

```text
Top-Level Panels
├─ Skills
│  ├─ Tab: Workbench
│  │  ├─ Group: Skill Tree
│  │  ├─ Group: Template Rollout
│  │  ├─ Group: Standards
│  │  └─ Group: Invocations
│  ├─ Drawer: Skill detail
│  └─ Drawer: Template/standard detail
│
├─ Evals
│  ├─ Tab: Runs
│  │  ├─ Group: Recent
│  │  ├─ Group: Failures
│  │  └─ Group: Artifacts
│  ├─ Tab: Tasks
│  │  ├─ Group: By skill
│  │  ├─ Group: By judge
│  │  └─ Group: Coverage
│  ├─ Tab: Health
│  └─ Drawer: Eval run/task detail
│
└─ Harness
   ├─ Tab: Health
   │  ├─ Group: Overview
   │  ├─ Group: Checks
   │  ├─ Group: Registries
   │  └─ Group: Freshness
   ├─ Tab: Map
   │  ├─ Group: Lifecycle
   │  ├─ Group: Graph
   │  ├─ Group: Guardrails
   │  └─ Group: References
   ├─ Tab: Rollout
   │  ├─ Group: Projects
   │  ├─ Group: Features
   │  ├─ Group: Templates
   │  ├─ Group: Skill Templates
   │  └─ Group: Drift
   └─ Drawer: Selected health/check/project/feature/node detail
```

## Default Open States

```text
Skills  -> Workbench -> Skill Tree
Evals   -> Runs -> Recent
Harness -> Health -> Overview
```

## Cross-Link Rules

```text
Harness Health stale skill templates -> Skills > Workbench > Template Rollout
Harness Health eval failures         -> Evals > Health
Harness Rollout feature row          -> Harness > Health > Registries
Harness Map lifecycle node           -> Harness > Map > Graph detail
Skills eval coverage gap             -> Evals > Tasks filtered by skill
```

## Why This Shape

- `Skills` and `Evals` stay one-click because they are frequent work modes.
- `Harness` combines maintenance concerns without becoming a catch-all for
  skill editing or eval execution.
- Tabs ask distinct questions; group buttons refine the current question.
- Details stay in drawers so the main table/graph does not disappear.
