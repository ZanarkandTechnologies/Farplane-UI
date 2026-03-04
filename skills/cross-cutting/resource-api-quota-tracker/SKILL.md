---
name: resource-api-quota-tracker
description: Refresh advisory API quota resource state and event history.
---

# Resource API Quota Tracker

## Goal

Track API quota consumption so agents can avoid expensive execution paths when quota is low.

## Inputs

- Project id
- Provider usage data (requests/tokens)
- Period limit configuration

## Outputs

- Updated `api_quota` resource remaining/limit
- `resourceEvents[]` refresh or consumption event

## Workflow

1. Query provider usage for current period.
2. Compute remaining quota.
3. Update `api_quota` resource entry.
4. Append event with delta and data source.

## Guardrails

- Keep units explicit (`requests` or `tokens`).
- Do not infer provider data when unavailable.
