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

## 2026-06-17 Evidence / Review Pass

- Work admission verdict: implementation was already present; this pass reconciled code and evidence instead of duplicating build work or rerunning `$impl-plan`.
- Scoped fix: annotated `rows` as `HookTelemetryRow[]` in `convex/modules/hookTelemetry/queries.ts` after `npm run lint` found `lint/suspicious/noImplicitAnyLet`.
- Reconciliation:
  - `hookTelemetryEvents` is registered in `convex/schema.ts`.
  - `/telemetry/hooks` and `/telemetry/hooks/batch` are registered in `convex/http.ts`.
  - Skill invocation and runtime telemetry dashboard queries derive from `hookTelemetryEvents`.
  - `rg "runtimeTelemetryActivityPings|skillInvocationEvents|/telemetry/activity|/skill-invocations/ingest" convex hooks scripts ui/src/modules/skill-invocations ui/src/modules/runtime -n` returned no matches.
- Checks:
  - PASS: `npm run test:once -- convex/modules/hookTelemetry convex/modules/skillInvocations hooks/skill-invocation-listener`
  - PASS: `npm run test:once -- convex/modules/runtimeTelemetry`
  - PASS: `npm run test:once -- convex/modules/hookTelemetry convex/modules/skillInvocations hooks/skill-invocation-listener convex/modules/runtimeTelemetry`
  - PASS: `npm run typecheck:root`
  - PASS: `npm run lint`
  - PASS: `node scripts/import-aikage-telemetry.mjs --dry-run --limit 1`
  - KNOWN FAIL: `npm run typecheck` fails in unrelated UI package files (`src/App.tsx`, AI Elements missing deps, `JSX` namespace errors, office/runtime type errors).
- Skipped:
  - `npx convex dev --once` because it can require live Convex credentials/deployment access.
  - live backfills or production migrations by safety boundary.
  - browser screenshot because unrelated UI typecheck failures make local UI proof noisy.
- Artifact: `tickets/building/TKT-038-unified-hook-telemetry/artifacts/2026-06-17-evidence-review.md`
- Review verdict: `TAS-A`, `pass-ready`, move local ticket state to `review` with residual screenshot caveat.
