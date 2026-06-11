---
status: active
owner: farplane-ui
created: 2026-06-11
tags:
  - ui
  - modules
  - refactor
  - architecture
---

# UI Module Migration

## Goal

Move Farplane UI toward feature-owned modules where each operator workflow owns
its shell, components, hooks, local logic, types, tests, docs, and public export
surface.

This adapts the working Valefor pattern from `apps/web/modules/`, where modules
are reusable workflow surfaces rather than generic file-type folders.

## Why Valefor Works

Valefor's web modules stay maintainable because:

- A module maps to a reusable workflow pattern, not a random component cluster.
- Public surfaces are exported through module entrypoints.
- Route-mounted/renderable modules are registered explicitly.
- Module docs are short wrappers, while detailed behavior lives in
  module-local `docs/`.
- Helpers stay local until a second real caller proves they are shared.
- Backend modules mirror frontend ownership where the product surface needs
  state, validators, actions, and schema fragments.

The result is that a future maintainer can open one folder and understand the
buyer/operator experience, its local contracts, and its QA path.

## Main Farplane UI Issues

- `ui/src/lib` has become a cross-domain bucket for runtime adapters, office
  layout, onboarding, task memory, review boards, device identity, session
  usage, skills, and gateway code.
- `ui/src/features` contains real ownership seeds, but module-sized workflows
  still leak into `components/hud`, `components/dialogs`, `providers`, and
  `lib`.
- Provider names and some file boundaries still reflect older OpenClaw-first
  assumptions even though the runtime adapter abstraction now supports Codex as
  the default path.
- Long files are symptoms of weak ownership boundaries: logic grows inside the
  first convenient shell instead of moving into module-local hooks and helpers.
- Documentation is uneven: `office-system` has useful invariants, but the
  README has accumulated changelog detail that should become module-local docs.

## Target Module Map

```text
office/          office scene, room shell, layout builder, object interaction,
                 scene-level QA probes
runtime/         runtime selection, adapter status, Codex/OpenClaw bridges,
                 runtime-specific settings
team-workspace/  team panel, kanban, artefacts, memory, timeline, project work
agent-workspace/ employee context, agent session, manage-agent workflows,
                 agent-local runtime configuration
skills-studio/   skill catalog, skill files, demos, per-agent skill assignment
chat/            chat sidebar, dialogs, transcript, composer
settings/        settings dialog sections and runtime-specific panels
qa-tools/        clickability probes, scene diagnostics, dev-only test surfaces
```

## Migration Rule

`move_when_touched(surface) -> module_folder + public_export + focused_tests`

Do not broad-move everything at once. When a surface is already being changed,
move the shell, hooks, helpers, tests, and docs into the owning module together.
Leave temporary re-export shims only when they prevent high-risk import churn.

## First Refactor Candidates

1. `runtime/`
   - Move runtime adapter provider/settings panels toward a runtime module.
   - Rename OpenClaw-first provider language where the abstraction is now
     runtime-generic.
   - Keep `ui/src/lib/openclaw/` as the adapter-specific library folder.

2. `settings/`
   - Move settings dialog shell and runtime-specific panels together.
   - Keep runtime-specific settings conditional on the selected adapter.

3. `team-workspace/`
   - Move Team Panel shell, board helpers, artefact hooks, task memory, and
     business flow UI into one module boundary.
   - Keep project/ticket folder sync logic local until another module needs it.

4. `office/`
   - Move scene shell, room geometry, layout builder helpers, object transform
     controls, and clickability probes into one module boundary.
   - Preserve existing `office-system` invariants during migration.

## Proof

- Module docs exist at `ui/src/modules/README.md` and
  `ui/src/modules/AGENTS.md`.
- Project rules now declare `ui/src/modules/` as the target home for
  product-sized UI work.
- Future implementation tickets should use this plan to pick the next module
  slice and avoid unrelated rename churn.
