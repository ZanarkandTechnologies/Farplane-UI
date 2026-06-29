# Farplane UI Module Shell Architecture

**Status**: Draft
**Created**: 2026-06-13
**Owner**: Farplane UI
**Ticket**: `tickets/building/TKT-007-renderer-shell-module-architecture/ticket.md`

## Purpose

Farplane UI is one human-facing app for operating Farplane AI. The app can be
rendered as a standard navigation-first web UI or as a spatial 3D office, but
both renderers open the same feature modules and read the same runtime state.

This spec prevents product forks such as "Console" and "Office" from becoming
separate business-logic stacks.

## Contract

```ts
type FarplaneUiRenderer = "standard" | "office3d";

type FarplaneUiPersistence = "local" | "cloud";

type FarplaneUiConfig = {
  renderer: FarplaneUiRenderer;
  persistence: FarplaneUiPersistence;
  modules: FarplaneUiModuleId[];
};
```

`FarplaneUiModuleId` is derived from the shell registry:

```ts
const moduleRegistry = {
  runtime: runtimeModule,
  settings: settingsModule,
  "skills-studio": skillsStudioModule,
  "review-board": reviewBoardModule,
  chat: chatModule,
} as const;

type FarplaneUiModuleId = keyof typeof moduleRegistry;
```

Do not maintain a separate global union of module ids by hand. Module identity
comes from explicit folders, imports, and registry entries.

## Renderers

### `standard`

The `standard` renderer is the conventional app UI. It exposes modules through
navigation, routes, tabs, dashboards, and panels. It replaces the product idea
formerly called "Console"; there should not be a separate `console` module.

### `office3d`

The `office3d` renderer is the spatial office UI. It exposes modules through
office objects, HUD launchers, object interactions, and the same module
registry used by `standard`.

The existing `ui/src/modules/office` folder remains the owner for 3D office
scene/object systems. The renderer boundary owns composition and entry, not
office feature internals.

## Modules

Modules are product capabilities. A module owns the feature a user can open,
configure, route to, or attach to an office object.

Examples:

- `runtime`
- `settings`
- `skills-studio`
- `review-board`
- `chat`
- `agent-activity`
- `mighty-guard`
- `nudges`
- `lessons`

Modules are first-party code, loaded through static imports and an explicit
registry. Do not build a dynamic JavaScript plugin loader for first-party UI
modules in this slice. Static imports keep Vite bundling, TypeScript checks,
tests, and code search understandable.

## Shared Logic

Use `ui/src/lib` for shared domain helpers only after there is a second real
caller. Keep helpers module-local until reuse is proven.

Do not introduce `packages/` for this architecture slice. A package boundary is
only justified when more than one workspace app imports the same library.

## Ownership Rules

```text
renderer(config, registry) -> layout + module entrypoints
module(runtime_state, user_intent) -> feature UI + local logic
lib(shared_inputs) -> shared helper output
```

- Renderer owns how a user enters, arranges, and launches modules.
- Module owns what the feature does.
- Runtime adapters own Codex/OpenClaw/local/cloud integration.
- `ui/src/lib` owns small cross-module helpers after reuse exists.
- Tickets own migration state and proof.

## Migration Map

| Old concept | New home | Notes |
| --- | --- | --- |
| Farplane Console | `standard` renderer | Not a module. |
| Farplane Office | `office3d` renderer plus `modules/office` scene systems | Renderer composes; module owns 3D internals. |
| Sigmax agent-hours dashboard | `modules/agent-activity` | Agent-hours, lifecycle pairs, activity log. |
| Tokenmaxer lifecycle tracking | `modules/agent-activity` | Same activity stream as agent-hours. |
| Active-work detector | `modules/nudges` | Warnings, reminders, quiet hours, local/Telegram signals. |
| Tokenmaxer keyboard warning | `modules/nudges` | Nudge policy, not health diagnosis. |
| Mighty Guard | `modules/mighty-guard` | Health findings, skill/eval freshness, maintenance queue. |
| Agent Learning Inbox | `modules/lessons` plus Mighty Guard inputs | Lessons/Troubles extraction and display; findings can feed Mighty Guard. |
| Hook setup snippets | `modules/runtime` and `modules/settings` | Adapter/runtime configuration. |
| Local/cloud persistence controls | `modules/runtime` and `modules/settings` | Config surface; storage details stay behind adapters. |
| Autonomous ecommerce shop | workflow/use case | Not a module until a concrete reusable UI capability exists. |

## First Implementation Seam

Add `ui/src/shell` as the boundary for renderer composition:

```text
ui/src/shell/
  README.md
  shell-config.ts
  module-registry.ts
  renderers/
    standard/
    office3d/
```

The first safe code move after this spec is:

```text
ui/src/components/office-simulation.tsx
  -> ui/src/shell/renderers/office3d/Office3dRenderer.tsx
```

Keep a compatibility export at the old path until call sites are migrated.

The standard renderer can initially wrap the current `ui/src/App/*` structure.
Do not split feature modules out of `ui/src/App/render-sections.tsx` until the
registry and renderer seam exist.

## Non-Goals

- No `console` module.
- No dynamic runtime module loader for first-party modules.
- No broad feature migration from old Sigmax/Aikage/Farplane Console code.
- No `packages/` boundary.
- No visual redesign.
- No persistence/storage redesign beyond naming `local` and `cloud`.

## Proof

A valid implementation of this spec should prove:

- `renderer = standard | office3d` is documented in project rules.
- Module ids are derived from the registry.
- The old Console/Office language maps to renderers, not product forks.
- Existing modules keep owning feature behavior.
- `git diff --check` passes.
