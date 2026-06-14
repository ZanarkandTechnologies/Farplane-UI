# Runtime Telemetry Convex Module Contract

## Boundaries

- Own Aikage-compatible activity lifecycle ingestion and shared agent-hours queries.
- Keep lifecycle duration math deterministic and testable outside Convex.
- Keep table definitions, validators, and function entrypoints module-local.

## Rules

- Completed agent hours come from matched `turn_start` -> `turn_end` rows or
  same-session next-start recovery when a stop hook is missing.
- Open or unmatched lifecycle rows are diagnostics.
- Do not store raw assistant output or transcripts.
- Keep local-only telemetry as a separate state-bridge concern; this module is for Convex/cloud/shared telemetry.

## Test

- `npm run test:once -- convex/modules/runtimeTelemetry`
- `npm run lint`
