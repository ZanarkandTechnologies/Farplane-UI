---
kind: goal-portfolio
status: draft
project: Farplane UI
created_at: 2026-06-17
updated_at: 2026-06-17
framework_template_version: "0.1.0"
owner: project-pm-automation
---

# Project Goals

## North Star

Make Farplane UI the reliable local office where an operator can see AI work,
steer teams, review artifacts, and move from idea to ticket-backed execution.

## Operating Priorities

1. Keep operator workflows visible, fast to enter, and backed by durable files.
2. Keep runtime adapters explicit: Codex by default, OpenClaw optional.
3. Make proof and review part of the work loop instead of an afterthought.

## KPI Axes

| Axis | Question | Current Signal |
| --- | --- | --- |
| Acquire / Use | Who should find or use this? | Founder-operators running local AI work |
| Activate | What is first value? | Open `/office` and understand active teams/work |
| Retain / Trust | Why would they return or trust it? | Work state, runtime state, and proof stay inspectable |
| Efficiency | What should get easier over time? | Moving from idea to ticket, plan, implementation, QA, and review |
| Quality | How do we know it is good? | Browser evidence, tests, pre-push gates, and review reports |

## Current Milestone

Reinitialize the project substrate to Farplane spec 1.1.0, then use the starter
PRD ticket only when product discovery needs a fresh planning pass.

## Holds

- Do not store secrets in tracked config.
- Do not deploy, spend, publish, or change accounts without approval.

## Goal Advisor Handoff

Use `goal-advisor` when the current milestone becomes executable enough to run
as a ticket-backed Goal Packet.
