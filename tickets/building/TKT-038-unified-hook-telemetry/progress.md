# TKT-038 Progress

## 2026-06-17 Implementation Pass

- Created `convex/modules/hookTelemetry` with raw `hookTelemetryEvents` schema, ingest mutations, HTTP payload parsing, projections, README, AGENTS, and focused tests.
- Added `/telemetry/hooks` and `/telemetry/hooks/batch` HTTP ingress.
- Updated `/telemetry/activity` and `/telemetry/activity/batch` to translate existing runtime pings into unified hook telemetry instead of writing the old runtime raw table.
- Updated `/skill-invocations/ingest` to translate legacy callers into unified hook telemetry instead of writing the old skill raw table.
- Updated `hooks/skill-invocation-listener` to post `skill-invocation-listener` / `PostToolUse` hook telemetry envelopes.
- Switched skill invocation dashboard queries to derive from `hookTelemetryEvents`.
- Switched runtime telemetry dashboard queries to derive from `hookTelemetryEvents`.
- Backfilled deployed legacy data into `hookTelemetryEvents`:
  - skill invocation rows: `168` inserted
  - runtime rows: `2,390` scanned, `2,390` present in hook telemetry after dedupe/copy
- Removed old raw table schemas and old raw ingest endpoints after backfill:
  - `runtimeTelemetryActivityPings`
  - `skillInvocationEvents`
  - `/telemetry/activity`
  - `/telemetry/activity/batch`
  - `/skill-invocations/ingest`

## Validation

- `npx convex codegen --typecheck=disable`
- `npm run test:once -- convex/modules/hookTelemetry convex/modules/skillInvocations hooks/skill-invocation-listener`
- `npm run test:once -- convex/modules/runtimeTelemetry`
- `npm run typecheck:root`
- `npx convex dev --once`
- `node scripts/import-aikage-telemetry.mjs --dry-run --limit 1`
