---
ticket_id: TASK-0006
title: Design Skills, Evals, And Harness Maintenance UI Hierarchy
phase: planning
status: review
owner: human
claimed_by: Codex
priority: high
depends_on: []
blocked_by: []
ready: false
approval_required: true
requires_qa: false
requires_demo: false
created_at: 2026-06-24
updated_at: 2026-06-24
next_action: review the design packet and choose which surfaces to build first with a Goal
last_verification: design packet created from functional-ui pass
---

# TASK-0006: Design Skills, Evals, And Harness Maintenance UI Hierarchy

## Summary
Design the next Farplane operator UI hierarchy before implementation. The
working decision is that `Skills`, `Evals`, and `Harness` should be separate
top-level panels, while all harness-maintenance concerns fit inside one
`Harness` panel with three major tabs: `Health`, `Map`, and `Rollout`.

This ticket is intentionally design-first. It produces ASCII UI specs and
interaction hierarchy so the operator can approve the shape before a native
Goal builds the surfaces.

## Scope
- In:
  - Define which surfaces are panels, tabs, group buttons, and drilldowns.
  - Produce ASCII UI designs for `Skills`, `Evals`, and `Harness`.
  - Include Harness subdesigns for `Health`, `Map`, and `Rollout`.
  - Include speed-dial / launcher entrypoint behavior.
  - Map data sources from the current harness-maintenance contract.
  - Produce a build roadmap for a later Goal.
- Out:
  - React implementation.
  - Vite bridge endpoints.
  - CLI resolver changes.
  - Styling finalization beyond functional layout requirements.
  - Browser QA, screenshots, or production build proof.

## Done / Proof

```text
done_when:
  - design packet covers Skills, Evals, Harness, and launcher hierarchy
  - each proposed panel has ASCII default state and key tab/group structure
  - each Harness tab maps to source payloads or generated artifacts
  - roadmap names the build order and first Goal slice
  - operator can approve, reject, or revise the design before implementation

proof:
  checks:
    - design files exist under tickets/TASK-0006/designs/
    - ticket remains in planning/review state
  manual:
    - human reviews ASCII designs
  review:
    - rubric: hierarchy clarity, daily-use ergonomics, data-source honesty, buildability
      required_tas: none before human review
  evidence:
    - tickets/TASK-0006/designs/00-hierarchy-design.md
    - tickets/TASK-0006/designs/01-harness-design.md
    - tickets/TASK-0006/designs/02-skills-design.md
    - tickets/TASK-0006/designs/03-evals-design.md
    - tickets/TASK-0006/designs/04-launcher-design.md
    - tickets/TASK-0006/designs/05-roadmap.md
```

## State
- `next_action:` review the design packet and pick revisions or the first build slice.
- `blocked:` false
- `latest_verification:` design packet created.
- `result:` pending human review.

## Links
- `program:` none yet
- `progress:` none yet
- `artifacts:` tickets/TASK-0006/designs/
- `review:` human review pending
- `refs:` `docs/farplane-framework/harness-maintenance.md`, `ui/src/modules/harness-os/`, `ui/src/modules/skills-studio/`, `ui/src/modules/evals/`
