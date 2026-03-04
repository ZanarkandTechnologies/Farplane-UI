---
name: resource-custom-tracker
description: Generic resource tracker for custom advisory resource types.
---

# Resource Custom Tracker

## Goal

Support pluggable custom resources without core framework changes.

## Inputs

- Project id
- Resource id
- Remaining/limit values
- Source and unit metadata

## Outputs

- Updated custom resource state
- Appended `resourceEvents[]` entry

## Workflow

1. Resolve the target custom resource definition.
2. Refresh remaining/limit values from source.
3. Persist update and event.
4. Return advisory summary for heartbeat context.

## Guardrails

- Preserve existing policy settings unless explicitly changed.
- Keep source and unit metadata consistent for UI readability.
