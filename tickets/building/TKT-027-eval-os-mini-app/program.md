---
ticket: TKT-027
program: Eval OS mini app implementation
status: active
created_at: 2026-06-14
loop_shape: active_goal
metric_provider: mechanical_plus_browser_qa
---

# Program

## Objective

Replace the current global Evals placeholder with a Farplane-native Eval OS
mini app based on the existing eval viewer and local run artifact contract.

## Files

- `tickets/building/TKT-027-eval-os-mini-app/ticket.md`
- `tickets/building/TKT-027-eval-os-mini-app/program.md`
- `tickets/building/TKT-027-eval-os-mini-app/progress.md`
- `tickets/building/TKT-027-eval-os-mini-app/generated-goal-prompt.md`
- `ui/src/modules/evals/**`
- `ui/src/modules/office/components/skills-panel.tsx`
- `ui/vite.config.ts`

## Budget

- time: current execution window
- token/model/compute: not specified
- subagents: optional, not required
- review: self-review plus ticket QA reconciliation
- QA: browser screenshot proof required
- spend: none

## Metric

Mechanical plus browser QA:

- Eval artifact helper tests pass.
- Focused lint passes.
- Filtered typecheck has no touched-file errors.
- Browser screenshots show Evals as a mini app, not a skill list.
- Endpoint snapshot confirms structured eval responses for missing and sample/populated data.

## Drift Policy

Inline drift check before final: compare implementation and screenshots against
`ticket.md`. Do not mark complete if Evals still looks like a Skill OS tab.

## Stop Policy

Complete only when Done / Proof is satisfied and `progress.md` is updated.
Block only if browser proof cannot be captured after trying the existing QA
bridge and direct route fallback.
