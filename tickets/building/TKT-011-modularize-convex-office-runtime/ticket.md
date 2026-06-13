---
id: TKT-011
title: Modularize Convex office runtime domains
status: building
owner: codex
assignee: codex
created: 2026-06-13
updated: 2026-06-13
complexity: M
---

# TKT-011: Modularize Convex Office Runtime Domains

## Status

- state: `building`
- owner: codex
- assignee: codex
- dependencies: TKT-010 runtime telemetry module
- location: `tickets/building/TKT-011-modularize-convex-office-runtime`
- enter when: user approved the Convex module split after backend review
- leave when: office runtime Convex domains have module folders, compatibility entrypoints, docs, and targeted checks
- blockers: full workspace typecheck has known unrelated alias debt in `cli/office-placement.test.ts`
- spawned follow-ups: none
- complexity: `M`

## Description

The Convex backend still had several live office runtime domains in root files:
board/status/events/memory/artefact index. These were relevant, but too broad and
hard to reason about after the runtime telemetry module landed.

## Goal

Move office-specific Convex backend ownership into module folders while keeping
existing generated API paths stable for the UI and HTTP router. Remove the
unneeded Convex team memory table and keep team memory file-backed.

## Acceptance Criteria

- [x] AC-1: `agentActivity`, `teamBoard`, and `projectArtefacts` have module-owned function/schema/docs surfaces.
- [x] AC-2: Root public/internal function paths remain available through compatibility entrypoints.
- [x] AC-3: `convex/schema.ts` composes table definitions from module schemas.
- [x] AC-4: Convex folder docs and AGENTS wording are Farplane-specific, not Valefor/default scaffold text.
- [x] AC-5: Team memory no longer uses Convex and renders Farplane memory Markdown files instead.

## Agent Contract

- Open: `convex/AGENTS.md`, `convex/_generated/ai/guidelines.md`, `PROJECT_RULES.md`
- Test hook: targeted Convex contract tests plus `npx tsc -p convex/tsconfig.json --noEmit`
- Stabilize: preserve root function paths for current UI/API callers
- Inspect: root wrappers, module folder ownership, schema composition
- Key screens/states: no UI surface changes intended
- Taste refs: backend modularity follows `convex/modules/runtimeTelemetry`
- Expected artifacts: updated module docs and this ticket
- Delegate with: not needed for this bounded refactor

## Evidence Checklist

- [x] Targeted contract tests pass
- [x] Convex TypeScript check passes
- [x] Lint passes or scoped lint passes
- [x] `git diff --check` passes

## Build Notes

- Keep old root file names as compatibility entrypoints.
- Prefer module-local implementations and schemas for new work.
- `npx convex codegen` succeeded and generated module API bindings while retaining root compatibility paths.
- Removed Convex team memory after user clarified shared memory should stay file-backed through Farplane Markdown docs.
- Team Panel Memory now fetches `/farplane/memory-files?projectPath=<activeProject.trackingContext>`, which serves `docs/MEMORY.md`, `docs/LESSONS.md`, `docs/TROUBLES.md`, and `docs/HISTORY.md` from that active project root.
- Full workspace `npm run typecheck` still fails on pre-existing `cli/office-placement.test.ts` alias debt.
- Full `npm run ui:typecheck` still fails on existing broad UI debt; filtered output has no hits for `team-memory`, `use-team-panel-memory`, `team-panel-types`, `team-panel.tsx`, or `vite.config`.

## QA Reconciliation

- AC-1: `PASS`
- AC-2: `PASS`
- AC-3: `PASS`
- AC-4: `PASS`
- AC-5: `PASS`

## Artifact Links

- Module docs under `convex/modules/*/{README.md,AGENTS.md}`
- Generated API proof: `convex/_generated/api.d.ts` includes new module paths.
- Team memory route: `ui/vite.config.ts` `/farplane/memory-files?projectPath=<absoluteProjectPath>`

## Required Evidence

- [x] Unit/integration/e2e tests pass as applicable: `npm run test:once -- convex`
- [x] Convex typecheck passes: `npx tsc -p convex/tsconfig.json --noEmit`
- [x] Lint passes: `npm run lint`
