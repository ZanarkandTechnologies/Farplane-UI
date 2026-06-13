# Farplane Convex Backend

This directory owns Farplane's shared Convex backend for office runtime status,
team boards, artefact metadata, and cloud telemetry.

## Shape

- `schema.ts` composes module-owned table definitions.
- `http.ts` is the thin HTTP router for CLI/hooks ingress.
- `modules/runtimeTelemetry/` owns activity lifecycle telemetry.
- `modules/agentActivity/` owns `agentEvents` and `agentStatus`.
- `modules/teamBoard/` owns `teamBoardTasks` and `teamBoardEvents`.
- `modules/projectArtefacts/` owns `projectArtefactIndex`.

Root files such as `board.ts`, `status.ts`, `events.ts`, and `team_artefacts.ts`
are compatibility entrypoints for existing generated API paths. Prefer new
implementation work inside the owning module folder.

Team/project memory is intentionally file-backed through Farplane Markdown docs,
not a Convex table.

## Checks

- `npx tsc -p convex/tsconfig.json --noEmit`
- `npm run test:once -- convex/<relevant-test>.test.ts`
