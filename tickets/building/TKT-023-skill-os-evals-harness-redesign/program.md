---
ticket: TKT-023
title: Skill OS, Evals, and Harness redesign goal program
status: active
created_at: 2026-06-13
loop_shape: active_goal
metric_provider: hybrid
---

# Goal Program

## Objective

Implement the corrected global Skill OS / Evals / Harness model with adapter
capability gating and screenshot-backed proof.

## Files

- `tickets/building/TKT-023-skill-os-evals-harness-redesign/ticket.md`
- `tickets/building/TKT-023-skill-os-evals-harness-redesign/program.md`
- `tickets/building/TKT-023-skill-os-evals-harness-redesign/progress.md`
- `ui/src/components/hud/office-menu.tsx`
- `ui/src/modules/office/components/employee/index.tsx`
- `ui/src/modules/office/components/skills-panel.tsx`
- `ui/src/modules/office/components/skills-panel-sidebar.tsx`
- `ui/src/modules/office/components/use-skills-panel-controller.ts`
- `ui/src/modules/office/components/skills-panel-data.ts`
- `ui/src/modules/office/components/skills-panel.runtime.ts`
- `ui/skill-studio-state.ts`
- `ui/vite.config.ts`

## Loop Shape

- type: `active_goal`
- owner: native Codex Goal
- execution style: implement, verify, screenshot, review, update ticket
- pause policy: pause only for destructive decisions, blocked browser runtime, or
  genuinely missing product decisions

## Budget

- time: one focused implementation window
- token/model/compute: not specified
- subagents: allowed for visual QA or focused review after implementation
- review: required before completion if the implementation remains broad
- QA: browser screenshots required
- spend: none

## Metric / Feedback Provider

Hybrid:

- mechanical: focused lint, tests, endpoint smoke, filtered typecheck
- visual: screenshots for the key states in the ticket
- review: self-review or reviewer pass against ACs before closeout
- human feedback: final operator judgment after screenshots

## Drift Policy

- Inline drift check after each material phase.
- Compare actual implementation against the corrected model:
  - `Skill OS` = skill control plane and skill-to-skill graph only
  - `Evals` = separate global eval run/suite surface
  - `Harness` = separate full harness map entrypoint
  - Codex employee radial skill action hidden
- If implementation starts mixing harness docs into Skill OS graph or putting
  global eval operations inside Skill OS, stop and correct.

## Logging Policy

Append compact entries to `progress.md` after:

- architecture/context read
- adapter capability change
- Skill OS implementation
- Evals implementation
- Harness implementation
- screenshot QA pass
- final reconciliation

## Proof Policy

Do not call the goal complete without:

- screenshot artifacts saved under `tickets/building/TKT-023-skill-os-evals-harness-redesign/artifacts/`
- screenshot paths listed in `ticket.md`
- QA report comparing observed UI to expected states
- checks recorded in `progress.md`

## Stop Conditions

- complete: all ACs pass and screenshot proof exists
- blocked: after three consecutive attempts the same blocker prevents browser
  proof or implementation cannot proceed without a product decision
- continue: useful implementation or proof work remains inside the current
  budget window
