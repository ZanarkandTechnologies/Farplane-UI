# Runtime Telemetry Module

Convex-backed runtime telemetry for project and team agent-hours dashboards.

This module is the cloud/shared telemetry lane. Local-only telemetry can be added
later through the state bridge without requiring this Convex table.

## Files

- `schema.ts`: module-owned table definitions.
- `validators.ts`: lifecycle validators and shared arg shapes.
- `telemetry.ts`: ingest mutation plus global/team dashboard queries.
- `runtimeTelemetry.ts`: deterministic reducer used by queries and tests.

## Lifecycle Recovery

When a stop hook is missed, the reducer treats the next `turn_start` from the
same `sessionId` as the previous open turn's inferred end. The newer turn stays
open until its own explicit stop or a later same-session start appears.

## Auth stance

Farplane telemetry is single-operator infrastructure today, so the dashboard does
not require Convex Auth. UI reads use the configured Convex deployment URL, and
HTTP writes can be protected with `FARPLANE_TELEMETRY_TOKEN` when the deployment
is shared beyond a trusted local workstation.

Add Convex Auth only when telemetry becomes multi-user or internet-facing with
per-user authorization requirements.

## Migration

Backfill real Aikage/Codex-era runtime rows with:

```bash
npm run telemetry:import:aikage -- --dry-run --since 2026-06-01
npm run telemetry:import:aikage -- --since 2026-06-01
```

The importer reads local Codex session JSONL and stop-hook logs, optionally plus
an Aikage-compatible JSONL export through `--aikage-jsonl <path>`. Each imported
row carries a deterministic `importKey`, and Convex dedupes by that key so reruns
do not inflate project or team stats.
