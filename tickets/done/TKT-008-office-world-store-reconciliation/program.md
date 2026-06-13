---
id: TKT-008-program
ticket: TKT-008
status: active
created: 2026-06-13
updated: 2026-06-13
---

# Goal Program: TKT-008 Office World Store

## Trigger

- mode: `active_goal`
- start: user requested Goal-backed execution on 2026-06-13
- stop: ticket Done / Proof is satisfied, evidence is captured, and ticket can move to `done`

## Metric / Feedback Provider

- provider: `hybrid`
- mechanical:
  - focused Vitest tests for office world reconciliation/store/provider behavior
  - `git diff --check`
  - `npm run ui:typecheck` attempted and reported honestly if blocked by known unrelated debt
- browser QA:
  - `/office` stays loaded across at least two poll intervals
  - debug logs show stable polls as `unchanged` or empty `changedKeys`
  - no loader reappears and URL remains `/office`
- review:
  - inline drift review compares `ticket.md`, this `program.md`, and `progress.md` before completion

## Drift Policy

- Use inline drift checks every turn.
- Compare current work against:
  - ticket Scope
  - Delta / Program
  - Done / Proof
  - hard gates
- Escalate to a separate reviewer only if implementation starts redefining runtime source-of-truth, adding full ECS/game loop scope, or changing renderer-shell architecture from `TKT-007`.

## After Each Turn

1. Append a compact progress entry to `progress.md`.
2. Record files changed, proof run, current drift verdict, next action, and blockers.
3. Continue from the largest unresolved Done / Proof gap.
4. Stop complete only after code, docs, focused tests, browser proof, and ticket state updates are done.
5. Report blocked only after trying safe alternatives and naming the one missing input.

## Constraints

- Keep this ticket to option 2: office world store and reconciliation boundary.
- Do not implement a full ECS/game loop.
- Do not change Codex/OpenClaw source-of-truth behavior.
- Do not overwrite unrelated dirty worktree changes.
- Keep compatibility for existing `useOfficeDataContext()` consumers during migration.

## Current Next Action

Implement the office world store, reconciliation helper, selector exports, provider commit path, first scene/bootstrap selector migration, tests, docs, and browser proof.
