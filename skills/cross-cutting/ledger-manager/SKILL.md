---
name: ledger-manager
description: Append and validate revenue/cost entries in project ledger for autonomous business accounting.
---

# Ledger Manager

## Goal

Maintain accurate `ledger[]` entries on each project so PM can compute net profit in heartbeat loops.

## Inputs

- projectId
- type: revenue or cost
- amount in cents
- source label
- description
- optional experimentId

## Outputs

- New ledger entry with stable id and timestamp
- Updated P&L snapshot (revenue, cost, profit)

## Workflow

1. Validate payload completeness and numeric amount.
2. Append a ledger entry to `project.ledger`.
3. Recompute totals for PM-facing summary.
4. Return a concise finance delta message.

## Guardrails

- Amount must be integer cents.
- Use explicit source labels (e.g. `amazon_associates`, `openai_api`).
- Never overwrite historical entries; append only.
