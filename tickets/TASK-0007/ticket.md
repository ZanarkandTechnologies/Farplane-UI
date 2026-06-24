---
ticket_id: TASK-0007
title: Implement Skills, Evals, And Harness Maintenance UI Hierarchy
phase: proof
status: done
owner: Farplane UI
claimed_by: Codex
priority: high
depends_on:
  - TASK-0006
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-06-24
updated_at: 2026-06-24
next_action: review screenshots and decide polish/build follow-up
last_verification: npm run ui:build, scoped git diff --check, Playwright proof, bridge endpoint checks
---

# TASK-0007: Implement Skills, Evals, And Harness Maintenance UI Hierarchy

## Summary
Implement the approved operator UI hierarchy from `TASK-0006`: keep `Skills`,
`Evals`, and `Harness` as first-class panels, restructure Harness into
`Health`, `Map`, and `Rollout`, and add the data-backed shell for rollout,
checks, and cross-panel navigation.

The first implementation pass should prioritize product structure and truthful
data boundaries over exhaustive polish. React should render CLI/generated
payloads and local module state; it must not reimplement registry, rollout, or
graph semantics from scratch.

## Scope
- In:
  - Restructure the Harness surface into `Health`, `Map`, and `Rollout` tabs.
  - Preserve the existing lifecycle cockpit under `Harness > Map > Lifecycle`.
  - Preserve existing graph and feature registry views under `Harness > Map`.
  - Add `Harness > Health` overview with checks, registries, freshness, and
    attention queue states using available generated artifacts and explicit
    placeholders where bridge data is not yet available.
  - Add `Harness > Rollout` views for Projects, Features, Templates, Skill
    Templates, and Drift.
  - Add or extend Vite bridge endpoints for read-only CLI JSON payloads when
    needed:
    - `python3 bin/farplane.py adoption scan --json`
    - `python3 bin/farplane.py skills rollout scan --json`
  - Upgrade `Skills` IA toward Workbench, Rollout, Invocations, and Standards
    while preserving existing Skill OS behavior.
  - Upgrade `Evals` IA toward Runs, Tasks, Health, and Artifacts while
    preserving existing eval module behavior.
  - Add launcher / horizontal dial hierarchy for `Skills`, `Evals`, and
    `Harness`, with issue badges only for actionable counts.
  - Add cross-links between Harness Health, Harness Rollout, Skills Rollout,
    and Evals Health where data is available.
  - Add loading, empty, error, disabled, and command-failure states for new
    CLI-backed views.
  - Capture desktop and mobile browser evidence for the new hierarchy.
- Out:
  - Editing registries, manifests, templates, skills, or eval tasks from the UI.
  - Mutating project adoption state.
  - Implementing eval execution from the UI unless it already exists safely.
  - Building historical snapshot trends.
  - Solving unrelated repo-wide TypeScript debt.
  - Replacing the current office 3D renderer or app shell.

## Done / Proof

```text
done_when:
  - Skills, Evals, and Harness are accessible as first-class operator panels or route-mounted surfaces.
  - Harness opens to Health Overview.
  - Harness Map contains the current lifecycle cockpit plus graph/reference views.
  - Harness Rollout renders adoption/rollout shell states and at least current-project data when available.
  - Skills includes Workbench, Rollout, Invocations, and Standards structure without regressing current Skill OS behavior.
  - Evals includes Runs, Tasks, Health, and Artifacts structure without regressing current Eval OS behavior.
  - Cross-links exist for the high-value paths documented in TASK-0006.
  - New UI has no horizontal overflow on desktop or mobile proof viewports.
  - Production UI build passes or blockers are documented with unrelated existing debt separated from touched-surface failures.

proof:
  checks:
    - npm run ui:build
    - git diff --check -- ui/src/AppRouter.tsx ui/src/modules ui/src/components/hud ui/src/components/ui
    - focused tests for any new model/parser/bridge helpers
  manual:
    - Playwright screenshot of Harness Health desktop and mobile
    - Playwright screenshot of Harness Map desktop and mobile
    - Playwright screenshot of Harness Rollout desktop and mobile
    - Playwright screenshot of Skills updated IA
    - Playwright screenshot of Evals updated IA
    - console/page error capture for each proof route
  review:
    - rubric: hierarchy matches TASK-0006, data-source boundaries are honest, existing Skill/Eval/Harness behavior is preserved, UI is scannable and operator-facing
      required_tas: visual-qa or human review before marking final design accepted
  evidence:
    - screenshots under tmp/ or ticket artifact path
    - command outputs summarized in progress.md
```

## State
- `next_action:` review screenshots and decide polish/build follow-up.
- `blocked:` false
- `latest_verification:` npm run ui:build, scoped git diff --check, Playwright proof, bridge endpoint checks.
- `result:` implemented.

## Links
- `program:` tickets/TASK-0007/program.md
- `progress:` tickets/TASK-0007/progress.md
- `generated_goal_prompt:` tickets/TASK-0007/generated-goal-prompt.md
- `design_ticket:` tickets/TASK-0006/ticket.md
- `designs:` tickets/TASK-0006/designs/
- `refs:` `ui/src/modules/harness-os/`, `ui/src/modules/skills-studio/`, `ui/src/modules/evals/`, `ui/src/components/hud/office-panel-registry.ts`, `ui/src/components/ui/speed-dial.tsx`
