---
title: "Launcher And Horizontal Dial Design"
ticket_id: TASK-0006
status: draft
owner: farplane-ui
created_at: 2026-06-24
updated_at: 2026-06-24
kind: design
refs:
  - ../../TASK-0006/ticket.md
  - ../../../ui/src/components/hud/office-panel-registry.ts
  - ../../../ui/src/components/ui/speed-dial.tsx
---

# Launcher And Horizontal Dial Design

## Decision

Use top-level panel entries for work modes, then horizontal dials inside panels.

```text
Top-level dial:
  Skills | Evals | Harness

Harness tab dial:
  Health | Map | Rollout

Harness group dial:
  changes per tab
```

## Office Launcher

```text
┌──────────────────────────────┐
│ OFFICE TOOLS                 │
├──────────────────────────────┤
│ Skills                       │
│ inspect skill graph/rollout  │
│                              │
│ Evals                        │
│ inspect behavior proof       │
│                              │
│ Harness                      │
│ health, map, rollout         │
└──────────────────────────────┘
```

## Horizontal Dial Pattern

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Skills] [Evals] [Harness]                                      command ... │
└──────────────────────────────────────────────────────────────────────────────┘
```

When `Harness` is active:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Harness                                                                      │
│ [Health] [Map] [Rollout]                                                     │
│                                                                              │
│ Health groups: [Overview] [Checks] [Registries] [Freshness]                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

When `Skills` is active:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Skills                                                                       │
│ [Workbench] [Rollout] [Invocations] [Standards]                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

When `Evals` is active:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Evals                                                                        │
│ [Runs] [Tasks] [Health] [Artifacts]                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Navigation Rules

- Top-level dial changes the mounted panel.
- Panel tabs change the major question.
- Group buttons refine the current tab.
- Drawers preserve selected detail when switching nearby groups in the same
  panel, but reset when switching top-level panels.

## Badges

Top-level entries can show small status badges:

```text
Skills  stale 12
Evals   fail 3
Harness drift 1
```

Badge rules:

- Use counts only for actionable issues.
- Avoid turning every count into a badge.
- Clicking a badge opens the most relevant filtered view.
