---
name: resource-cash-tracker
description: Refresh advisory cash budget resource values and record resource events.
---

# Resource Cash Tracker

## Goal

Update `cash_budget` resource state for a project so PM and executor heartbeats plan with real cash constraints.

## Inputs

- Project id
- Current wallet/balance reading
- Optional reserved spend value

## Outputs

- Updated `resources[]` entry for `cash_budget`
- Appended `resourceEvents[]` refresh or adjustment event

## Workflow

1. Read current cash balance from configured source.
2. Convert value to `usd_cents`.
3. Update matching cash resource remaining/limit.
4. Emit `resourceEvents[]` with delta and source.

## Guardrails

- Advisory mode only: do not block execution directly.
- Never silently drop failed refreshes; report source errors.
