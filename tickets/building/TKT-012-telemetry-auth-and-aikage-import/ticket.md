# TKT-012: Telemetry Auth Stance And Aikage Import

## Status

- state: `building`
- owner: Farplane UI
- assignee: Codex
- dependencies: TKT-010 runtime telemetry dashboard
- location: `tickets/building/TKT-012-telemetry-auth-and-aikage-import/ticket.md`
- enter when: telemetry dashboard is blocked by login/config uncertainty and needs real historical data
- leave when: auth stance is documented, UI Convex URL wiring is fixed, and Aikage/Codex telemetry can be imported idempotently
- blockers:
- spawned follow-ups:
- complexity: `M`

## Description

The telemetry dashboard should not require a user login while Farplane is a
single-operator office. The app needs a reliable way to see the configured Convex
deployment and to backfill real historical activity from Aikage/Codex traces
instead of random seed data.

## Goal

Make telemetry usable without adding premature Convex Auth, then provide a safe
import path for historical runtime pings.

## Acceptance Criteria

- [x] AC-1: Telemetry auth stance is documented as single-operator/no Convex Auth for now, with token-gated HTTP writes available.
- [x] AC-2: The UI can read the repo-root Convex URL without requiring duplicate `ui/.env.local` setup.
- [x] AC-3: Historical Aikage/Codex traces can be dry-run and imported through an idempotent script.
- [x] AC-4: Convex ingest dedupes imported rows by deterministic import key.

## Agent Contract

- Open: Convex telemetry module, UI Convex provider/config, local Aikage/Codex telemetry traces.
- Test hook: runtime telemetry tests, Convex codegen/typecheck, importer dry-run.
- Stabilize: keep imports rerunnable and avoid storing prompts unless explicitly requested.
- Inspect: telemetry dashboard should remain shadcn-style and read-only for normal users.
- Key screens/states: telemetry unavailable state, global telemetry dashboard, team telemetry tab.
- Taste refs: existing shadcn components and telemetry dashboard layout.
- Expected artifacts: ticket, module README note, importer command output.
- Delegate with: QA reviewer only if browser proof becomes UI-visible.

## Evidence Checklist

- [ ] Dry-run importer summary:
- [x] Dry-run importer summary: `npm run telemetry:import:aikage -- --dry-run --since 2026-06-01` found 1,665 pings.
- [x] Convex codegen/typecheck: `npx convex codegen` uploaded functions and ran generated TypeScript successfully.
- [x] Runtime telemetry tests: `npm run test:once -- convex/modules/runtimeTelemetry/runtimeTelemetry.test.ts ui/src/providers/convex-provider.test.ts` passed 4 tests.
- [ ] Optional browser evidence:

## Build Notes

- Current decision: no Convex Auth is needed while telemetry is single-operator
  and not multi-tenant. Reads are public to the configured deployment; writes can
  be protected by `FARPLANE_TELEMETRY_TOKEN`.

## QA Reconciliation

- AC-1: `PASS`
- AC-2: `PASS`
- AC-3: `PASS`
- AC-4: `PASS`
- Evidence item: `CAPTURED`

## Artifact Links

## User Evidence

- Supporting evidence:
- Supporting evidence: Imported 1,665 pings into `https://friendly-magpie-825.convex.site` from local Codex/Aikage-era traces for rows since 2026-06-01.
- Supporting evidence: Duplicate limited import left global telemetry at 1,665 pings, proving `importKey` dedupe.
- Supporting evidence: `getTelemetryDashboard` now reports 108 completed turns, 6.5548 agent-hours, 19 projects, and 2 teams.
- Supporting evidence: `getTeamTelemetry` for `team-proj-farplane` / `proj-farplane` reports 938 pings, 63 completed turns, and 2.6760 agent-hours.
- Final verdict: implemented and deployed; broad repo typecheck remains blocked by unrelated existing errors outside this slice.

## Required Evidence

- [x] Unit/integration/e2e tests pass (as applicable)
- [x] Typecheck passes for Convex codegen; broad repo typecheck has pre-existing unrelated failures
- [ ] Lint passes
