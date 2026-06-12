---
title: Farplane UI Code Review Guide
status: active
owner: Zanarkand Technologies
updated: 2026-06-12
---

# Farplane UI Code Review Guide

Use this guide for automated and human review. Review should find structural
issues that would make future agent work worse, not style nits that do not
change behavior.

The reusable review contract lives in the installed Farplane `code-review`
skill at `~/.codex/skills/code-review/SKILL.md`. This file is only the
Farplane UI overlay.

## Priorities

1. Maintainability: duplicated domain logic, hidden side effects, overlong new
   files, fragile ownership boundaries, missing shared modules, or code that
   bypasses module systems.
2. Branch consolidation: multiple commits that implement the same concept in
   different folders, helpers that should be shared, or related files that
   should move under one owning module before push.
3. Farplane UI structure: wrong module owner, missing `index.ts` public
   surface, helpers prematurely promoted to `ui/src/lib`, OpenClaw/Codex code
   mixed outside runtime adapter boundaries, or scene/provider files growing
   instead of delegating to systems/hooks.
4. React guidelines: avoid duplicated derived state, ad hoc polling/effects,
   avoidable rerenders, eager heavy imports, state mutation, and missing cleanup.
   Use `vercel-react-best-practices` when React code changed.
5. Documentation: substantial modules need README/AGENTS wrappers and local QA
   or feature notes when the change creates durable ownership.
6. Correctness: broken runtime behavior, invalid data flow, race conditions,
   stale state, missing null handling, wrong adapter behavior, or failed
   persistence.
7. Product UX: confusing office behavior, inaccessible controls, broken loading
   or error states, layout overlap, and missing user feedback.
8. Verification: missing tests or proof for risky structural changes, stale ticket state,
   and claims not backed by commands or browser evidence.
9. Security and privacy: secrets in logs, unsafe external input handling, broad
   filesystem/network assumptions, and private local paths in public artifacts.

## Farplane UI Rules

- Keep feature ownership inside `ui/src/modules/*` when possible.
- Keep provider and scene files thin. Domain logic belongs in module systems,
  adapters, hooks, or pure utilities with tests.
- Office placement and collision behavior belongs in
  `ui/src/modules/office/systems/*`.
- Runtime adapter behavior must stay conditional on the equipped adapter:
  Codex and OpenClaw capabilities should not be silently mixed.
- Shared behavior should stay module-local until there is a second real caller;
  then promote it to the owning module or a domain-named `ui/src/lib/<domain>/`
  folder, never to a generic catch-all utility.
- A branch that touches the same concept in several folders should propose the
  consolidation before push.
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
