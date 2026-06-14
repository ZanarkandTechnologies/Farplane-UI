---
ticket: TKT-031
title: Skill OS workbench invocation goal program
status: active
created_at: 2026-06-14
---

# Program

## Loop Shape

- type: `active_goal`
- owner: Codex
- pause policy: continue in this execution window unless blocked by missing
  local APIs or a destructive decision

## Budget

- time: not specified
- token/model: not specified
- subagents: none planned
- review: inline self-review plus ticket proof
- QA: browser screenshots required
- spend: none

## Metric / Feedback Provider

- provider: `hybrid`
- mechanical:
  - component renders without runtime errors
  - focused formatter/tests pass
  - browser assertions/screenshots cover the requested states
- product:
  - selected skill workbench makes special skill files discoverable
  - invocation counters are visible inside Skill OS without duplicating the
    TKT-025 telemetry source

## Drift Policy

- inline drift check against `ticket.md` after each material edit
- do not self-approve Reagraph changes; this ticket intentionally avoids that
  renderer

## Stop Policy

- complete when Done / Proof is satisfied and progress includes proof links
- blocked only if current data sources cannot expose enough skill content to
  render the workbench honestly
