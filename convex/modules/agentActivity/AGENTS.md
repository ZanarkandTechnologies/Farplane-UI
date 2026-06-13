# Agent Activity Convex Module Contract

## Boundaries

- Own append-only agent event history and reduced live status snapshots.
- Keep root `convex/events.ts` and `convex/status.ts` as compatibility entrypoints until callers migrate.
- Provide timeline/feed data to team board and team workspace surfaces.

## Rules

- Status is event-sourced: ingest rows first, then reduce to `agentStatus`.
- `stepKey` de-duplicates repeat reports.
- Keep durable activity history unless a manual cleanup explicitly requests pruning.

## Test

- `npm run test:once -- convex/status_contract.test.ts convex/status_http_contract.test.ts`
- `npx tsc -p convex/tsconfig.json --noEmit`
