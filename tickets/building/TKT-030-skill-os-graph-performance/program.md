---
ticket: TKT-030
title: Skill OS graph performance program
status: active
created_at: 2026-06-14
loop_shape: active_goal
metric_provider: mechanical
---

# Program

## Trigger

Operator requested graph performance optimization through `goal-advisor`.

## Metric

Mechanical/browser proof:

- Focused static checks pass.
- Focused registry/store tests pass.
- Browser proof opens Skill OS and captures fallback or Reagraph state.
- Normal headless path does not mount Reagraph.
- Forced-WebGL path does not leave a blank canvas visible.
- Skill overlay still opens from sidebar selection.

## Budget

- time: one focused implementation window
- token/model: not specified
- subagents: none unless blocked
- review: inline drift check
- QA: Playwright browser screenshots/assertions
- spend: no paid services

## Drift Policy

Inline drift check against `ticket.md` before completion. Do not expand into a
general graph redesign.

## Stop Policy

Complete when Done / Proof is satisfied. Block only if Reagraph import/type
compatibility prevents keeping both renderers available.
