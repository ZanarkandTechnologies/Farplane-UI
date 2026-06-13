# Runtime Telemetry Module

Convex-backed runtime telemetry for project and team agent-hours dashboards.

This module is the cloud/shared telemetry lane. Local-only telemetry can be added
later through the state bridge without requiring this Convex table.

## Files

- `schema.ts`: module-owned table definitions.
- `validators.ts`: lifecycle validators and shared arg shapes.
- `telemetry.ts`: ingest mutation plus global/team dashboard queries.
- `runtimeTelemetry.ts`: deterministic reducer used by queries and tests.
