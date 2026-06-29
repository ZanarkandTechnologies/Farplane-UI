---
ticket_id: TASK-0007
title: "Goal Program: Skills, Evals, And Harness Maintenance UI Hierarchy"
status: approval_pending
owner: Farplane UI
created_at: 2026-06-24
updated_at: 2026-06-24
trigger: native_goal
loop_shape: active_goal
metric_provider: hybrid
---

# Goal Program

## Goal Shape

```text
active_goal(ticket, design_packet, current_ui)
  -> implemented hierarchy
   + browser evidence
   + build/check proof
   + progress log
```

This is a material UI implementation Goal. Do not run until the operator
approves the Goal Packet.

## Source Files

```text
primary:
  tickets/TASK-0007/ticket.md
  tickets/TASK-0007/program.md
  tickets/TASK-0007/progress.md

design:
  tickets/TASK-0006/ticket.md
  tickets/TASK-0006/designs/00-hierarchy-design.md
  tickets/TASK-0006/designs/01-harness-design.md
  tickets/TASK-0006/designs/02-skills-design.md
  tickets/TASK-0006/designs/03-evals-design.md
  tickets/TASK-0006/designs/04-launcher-design.md
  tickets/TASK-0006/designs/05-roadmap.md

implementation anchors:
  ui/src/modules/harness-os/
  ui/src/modules/skills-studio/
  ui/src/modules/evals/
  ui/src/components/hud/office-panel-registry.ts
  ui/src/components/hud/office-menu.tsx
  ui/src/components/ui/speed-dial.tsx
  ui/vite.config.ts

framework context:
  AGENTS.md
  PROJECT_RULES.md
  /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/farplane-framework/harness-maintenance.md
  /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/experiments/decisions/2026-06-24-project-harness-rollout-feature/farplane-ui-handoff.md
```

## Execution Plan

```text
1. ground_current_ui()
   - inspect current Harness, Skills, Evals, launcher, speed-dial, and bridge patterns
   - identify existing dirty worktree files and avoid reverting unrelated changes

2. implement_harness_tabs()
   - Harness default tab becomes Health
   - current lifecycle cockpit moves under Map
   - graph and registry views remain reachable under Map
   - Rollout shell renders Projects/Features/Templates/Skill Templates/Drift groups

3. implement_rollout_data_path()
   - add read-only bridge endpoint(s) only where needed
   - run CLI from the owning Farplane repo/root contract
   - parse JSON into UI-facing model with loading/error/empty states
   - never recompute adoption or rollout semantics in React

4. upgrade_skills_ia()
   - preserve current Skill OS and invocation behavior
   - expose Workbench/Rollout/Invocations/Standards structure
   - use generated/CLI rollout payloads where available

5. upgrade_evals_ia()
   - preserve current eval module behavior
   - expose Runs/Tasks/Health/Artifacts structure
   - read-only v1 is acceptable if safe execution is not already present

6. wire_launcher_and_cross_links()
   - Skills, Evals, Harness are first-class entries
   - use horizontal dials/group buttons according to TASK-0006
   - add actionable badges only where counts are real
   - add cross-links for stale skills, eval failures, rollout drift, graph nodes

7. verify_and_repair()
   - run focused tests for new pure helpers
   - run npm run ui:build
   - capture desktop/mobile screenshots for Harness Health/Map/Rollout, Skills, Evals
   - inspect console/page errors and horizontal overflow
   - fix layout regressions before completion
```

## Budget

```text
time: one native Goal execution window; stop and report if scope exceeds a coherent first implementation pass
tokens: not specified
model/compute: not specified
subagents: use visual-qa/review lanes when available for final UI judgment
spend: none
deploy: none
```

## Metric / Feedback Provider

```text
hybrid:
  mechanical:
    - npm run ui:build
    - git diff --check on touched UI/ticket files
    - focused tests for new model/bridge helpers
  visual:
    - desktop/mobile screenshots with no overlap or horizontal overflow
    - console/page error capture
  human_feedback:
    - operator review of final UI evidence before design is considered accepted
```

## Drift Policy

```text
inline:
  - before each major edit, compare against TASK-0006 hierarchy and current ticket scope
  - after each major slice, append a compact progress entry
  - do not expand into registry/manifest editing or eval execution unless already safe and in scope

review:
  - if the implementation materially changes module boundaries or data ownership, pause and request review
  - if UI proof is unavailable, stop blocked with exact missing proof
```

## Proof Route

```text
qa path:
  - implementer captures Playwright screenshots/logs/result notes
  - visual-qa or human review judges screenshots against TASK-0006 designs
  - final completion requires strongest screenshot evidence as Markdown image links

self-certification:
  - allowed for mechanical command outputs
  - not sufficient for final visual acceptance
```

## Stop Conditions

```text
complete:
  - ticket Done / Proof satisfied
  - progress.md includes final proof summary
  - final response includes screenshot evidence links

blocked:
  - CLI data source cannot be reached and no honest fallback state can be rendered
  - existing unrelated repo debt blocks build and touched-surface fallback proof is insufficient
  - design packet contradiction requires operator decision
```
