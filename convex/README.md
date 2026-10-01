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
- `modules/telemetry/` owns `events` (source `hook` | `runtime`), which replaced
  `hookTelemetryEvents` and `agentEvents` (both kept only until readers move to
  `modules/telemetry/queries`, then drop them); `/telemetry/hooks` and `/ingest`
  write it.
- `modules/metrics/` owns `metricReadings` (latest and history per project
  metric; cash is metric `cash` from source `bank`), written via
  `/metrics/readings`.
- `modules/experiments/` owns `abTests`, `abSends` and `abSourceTotals`, written
  via `/experiments/ab`.

Changing data that shows on a screen lives here; definitions stay in repos.

Root files such as `status.ts`, `events.ts`, and `team_artefacts.ts` are
compatibility entrypoints for existing generated API paths. Prefer new
implementation work inside the owning module folder.

Team/project tasks, review state, and memory are intentionally file-backed
through Farplane `ticket.md` files, not Convex tables.

## Checks

- `npx tsc -p convex/tsconfig.json --noEmit`
- `corepack pnpm run test:once -- convex/<relevant-test>.test.ts`
