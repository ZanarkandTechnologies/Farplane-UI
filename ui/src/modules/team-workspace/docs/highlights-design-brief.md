---
title: Wins and Failures Gallery Design Brief
status: accepted
kind: design-brief
updated_at: 2026-07-26
feature_refs:
  - FEAT-0114
---

# Wins and Failures Gallery Design Brief

## Functional Basis

The local operator scans daily failures by review week, understands each
reusable lesson, and opens evidence only when needed. Daily failure cards
remain canonical; there is no ranking or promotion layer.

## Register

Operational product UI: restrained, dense enough to scan, stable, and low
ornament.

## Scene

A founder reviews the week in a dim office control surface and needs each
lesson to remain scannable without warning-color fatigue.

## Taste Dials

- Visual density: `7/10` — compact weekly review with evidence nearby.
- Design variance: `2/10` — one stable chronological list.
- Motion intensity: `1/10` — tactile control states only.
- Color commitment: `2/10` — neutral surfaces; semantic color is reserved.
- Materiality: `2/10` — flat bands, dividers, and one emphasis rule.

## Visual System

- Remove amber/brown gradients and nested bordered cards.
- Use theme-backed background, muted, border, foreground, primary, and
  destructive tokens only.
- Use normal product typography for lessons and summaries; reserve compact
  metadata treatment for dates, counts, and badges.
- Render daily failures as a divided list with compact evidence links.
- Render secondary navigation as an underline rail rather than a second boxed
  segmented control.

## States

- Loading and read errors remain honest.
- No daily failures: show one compact empty state.
- Week selector: switch the divided list between Monday-based review weeks.
- No ranking, voting, promotion, or duplicated weekly card state.

## Anti-Slop Constraints

- No gradients, glass, decorative shadows, oversized icon tiles, or generic
  equal-weight card grid.
- No new fonts or global palette changes.
- No color-only status communication.
- No browser storage or duplicated failure records.
