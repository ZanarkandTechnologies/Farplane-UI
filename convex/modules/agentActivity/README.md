# Agent Activity Module

Convex-backed agent status, activity events, and team activity feed composition.

## Files

- `schema.ts`: `agentEvents` and `agentStatus` table definitions.
- `contracts.ts`: status/event state reducers and coercion helpers.
- `httpContracts.ts`: HTTP payload parsing for ingest, report, and authenticated team activity reads.
- `events.ts`: internal mutations for event ingestion and status reports.
- `status.ts`: public status and activity feed queries.
