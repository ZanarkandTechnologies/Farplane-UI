---
title: Farplane UI Code Review Guide
status: active
owner: Zanarkand Technologies
updated: 2026-06-12
---

# Farplane UI Code Review Guide

Use this guide for automated and human review. Review should find issues that
would matter after merge, not style nits that do not change behavior.

## Priorities

1. Correctness: broken runtime behavior, invalid data flow, race conditions,
   stale state, missing null handling, wrong adapter behavior, or failed
   persistence.
2. Maintainability: duplicated domain logic, hidden side effects, overlong new
   files, fragile ownership boundaries, or code that bypasses module systems.
3. Product UX: confusing office behavior, inaccessible controls, broken loading
   or error states, layout overlap, and missing user feedback.
4. Verification: missing tests or proof for risky changes, stale ticket state,
   and claims not backed by commands or browser evidence.
5. Security and privacy: secrets in logs, unsafe external input handling, broad
   filesystem/network assumptions, and private local paths in public artifacts.

## Farplane UI Rules

- Keep feature ownership inside `ui/src/modules/*` when possible.
- Keep provider and scene files thin. Domain logic belongs in module systems,
  adapters, hooks, or pure utilities with tests.
- Office placement and collision behavior belongs in
  `ui/src/modules/office/systems/*`.
- Runtime adapter behavior must stay conditional on the equipped adapter:
  Codex and OpenClaw capabilities should not be silently mixed.
- Prefer deterministic checks and proof artifacts before reviewer judgment.
- New source files over 500 lines need an explicit ticket note or refactor.
- Existing large files may be touched narrowly, but do not add unrelated
  responsibility to them.

## Finding Format

Return only actionable findings introduced or exposed by the diff. Each finding
needs:

- severity: `critical`, `high`, `medium`, or `low`
- file path
- line number or narrow line range when possible
- concise issue
- concrete recommended fix

Use `patch_correct = true` only when there are no blocking correctness,
security, or maintainability findings.
