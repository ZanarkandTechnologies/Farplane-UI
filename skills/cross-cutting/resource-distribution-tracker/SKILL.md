---
name: resource-distribution-tracker
description: Track advisory distribution slot limits (posts/day) across channels.
---

# Resource Distribution Tracker

## Goal

Maintain channel posting capacity (`distribution_slots`) so executor actions stay realistic.

## Inputs

- Project id
- Platform posting counts
- Daily posting limit configuration

## Outputs

- Updated distribution slot remaining/limit
- `resourceEvents[]` event showing slot usage changes

## Workflow

1. Read platform post count for active day/window.
2. Calculate remaining slots.
3. Update `distribution_slots` resource state.
4. Record refresh/consumption event.

## Guardrails

- Use platform-specific metadata in resource entry.
- If source is unavailable, surface warning and leave prior state unchanged.
