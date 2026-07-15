---
ticket_id: TASK-0056
title: Make Codex employee controls lineage-first
phase: implementation
status: done
owner: Farplane UI
claimed_by: codex
priority: high
depends_on: [TASK-0054, TASK-0055]
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-07-16T00:00:00Z
updated_at: 2026-07-16T02:20:00Z
next_action: observe the first live multi-task hook lineage in normal use; the graph path is implemented and covered with connected-component tests
last_verification: 9 focused inspector/lineage tests and root TypeScript check pass; desktop and 390x667 browser QA, pan-stability geometry checks, current interface-guideline audit, and independent repaired-diff re-review pass; workspace UI typecheck remains blocked by unrelated repo-wide errors outside this ticket
---

# TASK-0056: Make Codex Employee Controls Lineage-First

## Summary

Replace OpenClaw-only employee controls with a capability-driven Codex surface.
Codex employees expose conversation, local movement, and inspection actions;
hook-observed child threads can replay their parent link for a few seconds; and
the inspector renders the hook-backed handoff neighborhood without requiring a
Codex app-server connection.

## Scope

- `In:` Codex radial action composition, read-only thread inspector, connected
  parent/children handoff graph, temporary parent-link replay, focused tests and
  browser evidence.
- `Out:` changing OpenClaw management behavior, persisting ephemeral subagents
  as durable employees, or adding a second lineage data source.

## Delta

> **Before:** Codex employees inherit Computer, Manage, Skills, and Context
> controls whose backing capabilities belong to OpenClaw.
>
> **After:** App-server-backed Codex tasks show Chat, Inspect, and Move/Release;
> hook-observed tasks show Activity and Move/Release. The inspector is a
> searchable hook-backed graph of the selected task's connected lineage.
>
> **Example:** Selecting an ephemeral node and choosing `Show Handoff in Office`
> replays a light-blue parent-to-child pulse for 2.2 seconds while the worker
> remains outside the durable office roster.

## Done / Proof

- [x] Codex and OpenClaw action sets are capability-correct.
- [x] Inspector remains useful with app-server disconnected.
- [x] Manual lineage replay reuses the scene lineage renderer and expires.
- [x] Connected lineage graph distinguishes current, root, task, and ephemeral nodes.
- [x] Three-action radial menus use even angular spacing and stay 40px while the camera pans.
- [x] Focused tests, root typecheck, browser QA, and implementation review pass;
  workspace UI typecheck residual is recorded below.

## Evidence

- `artifacts/codex-radial-even.png`: evenly spaced three-action radial menu.
- `artifacts/codex-lineage-graph-observed.png`: desktop graph-first thread inspector.
- `artifacts/codex-lineage-graph-short-mobile.png`: 390×667 responsive graph inspector with all controls visible.
- `artifacts/codex-lineage-light-blue.png`: unified light-blue handoff pulse in the office.
- `artifacts/qa/2026-07-16-graph-redesign/visual-qa.md`: geometry-backed visual QA verdict.
- `artifacts/review/2026-07-16-completion-receipt.json`: independent repaired-diff verdict.
- `artifacts/review/2026-07-16-graph-correction-receipt.json`: independent responsive, direction, and contrast re-review.

## Residual Risk

The workspace-wide UI typecheck currently fails across unrelated existing and
concurrent surfaces (including missing AI-element dependencies, JSX namespace
errors, office model mismatches, and runtime adapter contracts). The focused
Vitest suite transpiles and passes every changed inspector/lineage path, and no
reported TypeScript diagnostic names a changed TASK-0056 implementation file.
