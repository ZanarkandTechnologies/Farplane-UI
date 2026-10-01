# Telemetry Convex Module Contract

- Own the one `events` log (`source`: `hook` | `runtime`); interpretation stays in projection modules.
- Every reader goes through `reads.ts`; `queries.ts` is the reader-facing path.
- `hookTelemetryEvents` and `agentEvents` are drop-after-readers-move; nothing writes them.
- Test: `npx vitest run convex/modules/telemetry`
