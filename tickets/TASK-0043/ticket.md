---
ticket_id: TASK-0043
title: Add skill activity landmarks to the 3D office
phase: review
status: review
owner: codex
priority: high
depends_on: []
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-07-12T10:30:00Z
updated_at: 2026-07-12T11:05:00Z
next_action: review completed implementation and browser evidence
last_verification: 29 focused tests pass; UI build passes; browser probe renders six landmarks with no page errors
---

# TASK-0043: Add skill activity landmarks to the 3D office

## Summary

Create native low-poly Three.js activity landmarks that make semantic skill
invocations visible in the office. Place and bind a useful initial set in the
operator's live sidecar while preserving existing single-skill bindings.

## Scope

- In: reusable landmark renderer, gym/library/studio/planning/QA/workshop variants,
  builder registration, collision footprint, multi-skill target metadata, live placement,
  focused tests, browser proof.
- Out: skeletal character animation authoring, formal room entities, ticket-type routing,
  and changes to persisted employee desk ownership.

## Delta

```text
overall_before:
  - one office object can target one exact skill
  - built-in furniture does not visually describe broad activity categories
overall_after:
  - one landmark can host multiple semantic skills
  - six native prop clusters provide readable skill destinations
tradeoff:
  - initial activity uses existing ghost/blink effects; bespoke avatar workout motions are deferred
```

## Change Plan

### Change 1: Activity landmark renderer

```text
write:
  - ui/src/modules/office/components/activity-landmark.tsx
  - ui/src/modules/office/prefabs/activity-landmark-prefab.tsx
operation:
  - render six lightweight prop clusters from native R3F geometry
  - register one movable persisted mesh type
qa:
  - UI typecheck filter and browser screenshot
```

### Change 2: Multi-skill semantic routing

```text
write:
  - ui/src/modules/office/object-ui/*
  - ui/src/modules/office/skill-targeting.ts
operation:
  - preserve skillId and add normalized skillIds aliases
  - expose comma-separated mappings in the binding inspector
qa:
  - focused metadata and targeting tests
```

### Change 3: Placement and live configuration

```text
write:
  - cli/office-commands.ts
  - cli/office-placement.ts
  - ~/.farplane/office-objects.json through the canonical office CLI
operation:
  - add collision dimensions and structured metadata parsing
  - auto-place and bind six landmarks in the current office
qa:
  - office doctor/list plus /office visual QA
```

## Done

```text
done_when:
  - six landmark variants render through the persisted office-object pipeline
  - exact skill and multi-skill aliases resolve to the configured landmark
  - live sidecar contains placed, non-colliding landmark instances
  - focused tests pass and /office evidence shows a nonblank scene with landmarks
```

## QA Strategy

```text
qa_strategy:
  proof_weight: visual_qa
  checks:
    - metadata and skill-targeting Vitest tests
    - CLI placement tests and office doctor
    - UI build/typecheck with existing-debt separation
  manual:
    - open /office and inspect landmark composition, spacing, and console errors
  evidence:
    - tickets/TASK-0043/artifacts/browser-qa/
  residual_risk:
    - bespoke avatar animations are not part of this first landmark slice
```

## Agent Contract

- Open: `npm run ui`, then `/office`
- Test hook: object list plus `window.__farplaneOfficeLiveEmployeePositions`
- Stabilize: live `~/.farplane/office-objects.json`; builder shortcut `Alt+Shift+B`
- Inspect: canvas screenshot, browser console/errors, Object Binding Inspector
- Key screens/states: normal office, builder mode, configured landmark inspector
- QA cookbook: `qa/cookbook/office.md`

## Links

- `program:` none
- `progress:` none
- `artifacts:` `tickets/TASK-0043/artifacts/`
- `review:` implementation self-review complete; independent review pending
- `refs:` `ui/src/modules/office/AGENTS.md`, `docs/MEMORY.md`
