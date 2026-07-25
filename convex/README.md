# Farplane Convex Backend

This directory owns Farplane's shared Convex backend for office runtime status,
agent activity, artefact metadata, and cloud telemetry.

## Shape

- `schema.ts` composes module-owned table definitions.
- `http.ts` is the thin HTTP router for CLI/hooks ingress.
- `modules/runtimeTelemetry/` owns activity lifecycle telemetry.
- `modules/agentActivity/` owns `agentEvents` and `agentStatus`, including the
  `farplane status` activity surface.
- `modules/projectArtefacts/` owns `projectArtefactIndex`.

Root files such as `status.ts`, `events.ts`, and `team_artefacts.ts` are
compatibility entrypoints for existing generated API paths. Prefer new
implementation work inside the owning module folder.

Team/project tasks, review state, and memory are intentionally file-backed
through Farplane `ticket.md` files, not Convex tables.

## Checks

- `npx tsc -p convex/tsconfig.json --noEmit`
- `corepack pnpm run test:once -- convex/<relevant-test>.test.ts`
