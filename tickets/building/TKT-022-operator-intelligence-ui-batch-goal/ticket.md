# TKT-022: Operator Intelligence UI Batch Goal

## Status

- state: `building`
- owner: Farplane UI
- assignee:
- dependencies: TKT-009, TKT-010, TKT-012, TKT-013, TKT-014, TKT-015, TKT-016, TKT-017, TKT-018, TKT-019, TKT-020, TKT-021
- location: `tickets/building/TKT-022-operator-intelligence-ui-batch-goal/ticket.md`
- enter when: FP01 exists and the operator wants a quick first implementation pass over the new UI tickets
- leave when: a fast lift-and-shift pass has advanced the proceedable operator-intelligence UIs and recorded per-ticket proof or blockers
- blockers: source UI may be unavailable for some Aikage/skill surfaces; automations and Mighty Guard are intentionally underdefined
- spawned follow-ups:
- complexity: `L`

## Description

Run TKT-013 through TKT-021 as one native Goal-backed batch. The priority is a
quick useful pass, not perfection: reuse existing Farplane modules, skill UIs,
Aikage UI ideas, and shadcn-style primitives wherever possible.

The batch should avoid overdesign. Existing-good surfaces such as telemetry
should receive light polish only. Skills and evals should be lifted and adapted
from existing UIs where available. Goals, docs/memory, hardcases, automations,
and guard should start with the smallest honest UI that makes local data visible.

## Scope

- Primary spec: `docs/specs/FP01-operator-intelligence-modules-roadmap.md`.
- Source tickets: `tickets/todo/TKT-013-*` through `tickets/todo/TKT-021-*`.
- UI target: first-party modules under `ui/src/modules/*` and Team Panel tabs
  where the ticket calls for scoped views.
- Style: existing Farplane shadcn-style primitives and current Team Panel visual
  language.
- Batch rule: preserve one proof row per ticket. If a ticket is blocked or too
  fuzzy, implement the safe visible shell and log the blocker instead of
  stalling the entire batch.

## Agent Contract

- Open: FP01, all listed source tickets, relevant module README/AGENTS files, existing UI implementations, and any Aikage/skill source UI that can be found locally.
- Test hook: focused unit/normalizer tests where added; `npm run test:once` for touched tests; `npm run lint` or focused lint when practical.
- Stabilize: fixtures/static adapters for local docs, memory, eval, automation, or hardcase rows before complex runtime wiring.
- Inspect: global launcher entries, Team Panel tabs, empty states, source path labels, and reused UI fidelity.
- Key screens/states: telemetry polish, skills graph, eval/QA UI, docs/memory Markdown, goals roadmap/KPIs, hardcase filter, automation source-unavailable state, guard advisory shell.
- QA cookbook: `qa/README.md`, then relevant office/browser cookbook if screenshots are captured.
- Taste refs: current Team Panel screenshot and Farplane shadcn module style; no theme refresh, no new project-tree furniture.
- Expected artifacts: per-ticket proof row in `progress.md`, focused command results, and browser screenshots for UI-bearing changes when feasible.
- Delegate with: this ticket, `program.md`, `progress.md`, FP01, and the source tickets.

## Done / Proof

- [x] TKT-013 telemetry has either a small useful UI polish or an explicit no-op proof that the current UI already satisfies the quick-pass intent.
- [x] TKT-014 skills reuses or adapts the existing skills / skill-maintenance graph pattern.
- [x] TKT-015 evals/QA reuses or adapts the existing eval/QA UI pattern.
- [x] TKT-016 docs/memory renders Markdown more nicely and preserves literal project files.
- [x] TKT-017 automations has a first visible state or a documented source-unavailable shell after source inspection.
- [x] TKT-018 Mighty Guard has a small advisory shell or a documented deferral if source semantics remain unclear.
- [x] TKT-019 hardcases exist as an eval/QA filter or a minimal inventory view with export gates disabled.
- [x] TKT-020 goals has a Team Panel/global shell for roadmap, active projects, KPIs, phase targets, and next phase.
- [x] TKT-021 docs/testament rendering exposes FP/legacy docs and Team Panel project files/docs entry.
- [x] One proof row exists per source ticket in `progress.md`.
- [x] Browser-visible changes have screenshots or a documented reason screenshots could not be captured.
- [x] Mechanical checks are run for touched code, or failures are documented with whether they are pre-existing.

## Non-Goals

- Do not create a new project-tree UI as the primary model.
- Do not refresh the theme panel.
- Do not replace the Team Panel with separate furniture for these modules.
- Do not build a public hardcase marketplace/export flow.
- Do not make Mighty Guard auto-repair code.
- Do not force Convex/Auth into local-first UI shells unless an existing module already needs it.
