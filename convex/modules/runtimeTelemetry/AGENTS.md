# Runtime Telemetry Convex Module Contract

## Boundaries

- Own Aikage-compatible activity lifecycle ingestion and shared agent-hours queries.
- Keep lifecycle duration math deterministic and testable outside Convex.
- Keep table definitions, validators, and function entrypoints module-local.

## Rules

- Only matched `turn_start` -> `turn_end` rows count as completed agent hours.
- Open or unmatched lifecycle rows are diagnostics.
- Do not store raw assistant output or transcripts.
- Keep local-only telemetry as a separate state-bridge concern; this module is for Convex/cloud/shared telemetry.

## Test

- `npm run test:once -- convex/modules/runtimeTelemetry`
- `npm run lint`
