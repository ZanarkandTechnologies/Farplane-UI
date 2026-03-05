---
name: amazon-affiliate-metrics
description: Read Amazon Associates metrics (clicks, conversions, commissions) and emit structured metric and ledger updates.
---

# Amazon Affiliate Metrics

## Goal

Collect business outcome metrics from Amazon Associates and normalize them for ShellCorp business tracking.

## Inputs

- Project id and business type
- Reporting window (default: last 24 hours)
- Affiliate tag / account context from slot config

## Outputs

- Metric event payload:
  - clicks
  - ordered_items
  - shipped_items
  - conversion_rate
  - revenue_cents
- Optional ledger entries for realized commission payouts

## Workflow

1. Open the affiliate dashboard and load the reporting window.
2. Extract core metrics and convert currency values to cents.
3. Write a new `metricEvents[]` entry for the project.
4. If commission is realized, write a `ledger[]` revenue entry.
5. Return a concise summary for PM review.

## Guardrails

- Never invent revenue.
- If the dashboard cannot be reached, return a measurable error and do not write metrics.
- Keep source labels explicit (e.g. `amazon_associates`).
