# UI Modules

## Purpose

Reusable product and workflow surfaces for Farplane UI. A module owns a
coherent operator experience: the route or panel shell, local components, local
logic, types, configuration, docs, tests, and public entrypoint for that
experience.

Use modules for feature-sized surfaces that can be opened, routed, tested, or
explained as one product capability. Keep small shared primitives in
`ui/src/components/ui`, and keep true cross-module contracts in domain-named
folders under `ui/src/lib`.

## Current Shape

Farplane UI still has legacy `features/`, `components/`, `providers`, and
`lib` surfaces. Treat those as source neighborhoods during migration, not as a
reason to keep growing catch-all folders.

```text
office/          target owner for the office scene, room shell, layout builder,
                 object interaction, and scene-level QA probes
runtime/         target owner for runtime selection, adapter status, Codex and
                 OpenClaw bridge panels, and adapter-facing settings
team-workspace/  target owner for team panels, kanban, artefacts, memory, and
                 project-scoped work surfaces
agent-workspace/ target owner for employee context, agent sessions, manage-agent
                 workflows, and agent-local runtime configuration
skills-studio/   target owner for skill catalog, skill files, demos, and
                 per-agent skill assignment UI
chat/            target owner for chat sidebar, dialogs, messages, composer,
                 and transcript rendering
settings/        target owner for settings dialog sections and runtime-specific
                 configuration panels
qa-tools/        target owner for operator/dev probes such as clickability and
                 scene diagnostics
```

These folders are migration targets. Add a module folder when a touched feature
needs a real boundary; do not move unrelated files only to satisfy the map.

## Module Contract

Each substantial module should use this shape:

```text
<module>/
├── AGENTS.md
├── README.md
├── index.ts
├── components/
├── hooks/
├── lib/
├── types.ts
├── docs/
│   ├── feature-registry.md
│   └── qa-runbook.md
└── *.test.ts(x)
```

- `README.md` is the human orientation wrapper.
- `AGENTS.md` is the agent-facing operating wrapper.
- `index.ts` exports the public module surface.
- `components/`, `hooks/`, and `lib/` are private unless exported from
  `index.ts`.
- `docs/feature-registry.md` lists user-visible capabilities and ownership.
- `docs/qa-runbook.md` lists the module's proof path and browser checks.

Tiny modules may start with only `README.md`, `AGENTS.md`, and `index.ts`, but
they should grow inward before leaking helpers into global folders.

## Add Or Change A Module

1. Put local workflow code inside the owning module first.
2. Export only intentional public surfaces through `index.ts`.
3. Keep helpers local until there is a second real caller.
4. Promote cross-module contracts into domain-named `ui/src/lib/<domain>/`
   folders, not generic utility buckets.
5. Register route-mounted or globally launched modules at the app entrypoint or
   launcher registry that renders them.
6. Add targeted tests for derived logic and a module QA note for user-visible
   behavior.

## Do Not

- Do not create one module per tiny component.
- Do not create bespoke modules when configuration on an existing module is
  enough.
- Do not place OpenClaw-specific code outside `openclaw/` or runtime adapter
  boundaries.
- Do not add catch-all `utils.ts` files for domain behavior.
- Do not duplicate module behavior across README, AGENTS, and project docs;
  keep detailed behavior in the nearest module doc.

## Test

```bash
npm run ui:build
npm run build
```

For browser-visible modules, start `npm run ui` and follow the relevant
`qa/cookbook/*` or module-local `docs/qa-runbook.md`.
