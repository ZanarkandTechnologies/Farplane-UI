# TROUBLES

Append-only log for repeated failures, user corrections, and preventable misses.

Format:
`YYYY-MM-DD HH:mm Z | area,tags | request | miss | correction | prevention`

Promote only durable lessons from here into `docs/MEMORY.md` or the relevant skill/contract.

2026-06-15 17:06 Z | telemetry,hooks,codex | Telemetry tab had no recent events and Codex locks looked suspicious | Global Farplane Console ping hooks ran without `FARPLANE_CONVEX_SITE_URL` in the Codex app-server environment, and clean-env execution resolved a Python with broken HTTPS certificates; live Convex ingestion stopped while local Codex/session logs still captured recoverable rows | Updated `~/.codex/hooks.json` to source `~/.codex/config.local.env` before the ping hook and pin `/opt/homebrew/bin/python3`; backfilled `2026-06-14` onward with `npm run telemetry:import:aikage -- --since 2026-06-14 --site-url https://friendly-magpie-825.convex.site` | Hook smoke must be tested from a clean env and verified in Convex; importer runs should pass an explicit `--site-url` when shell env is not guaranteed.
2026-06-24 08:59 Z | telemetry,office,codex | Office employees disappeared while local hook events existed and Harness Usage showed no recent events | Rendering only consumed app-server threads or Convex `hookTelemetryEvents`; local `~/.farplane/events` rows were not part of the observed-worker path, and Vite did not derive the Convex client URL from the configured Convex site URL | Added a local observed Codex worker bridge that maps recent `~/.farplane/events` JSONL rows into read-only office workers, and made Vite derive `VITE_CONVEX_URL` from `.convex.site` URLs | When telemetry is the fallback source, prove the chain from local event file to UI provider state, not only from Convex dashboards.
2026-06-28 12:00 Z | settings,persistence,config | Office layout settings did not persist after Apply View | Started adding another browser localStorage key for office settings despite project-local config/sidecar rules and the existing config-file direction | Added an AGENTS invariant against new localStorage/env fallback surfaces and rerouted debugging toward the canonical config/sidecar state bridge | For settings persistence bugs, inspect the owning config/sidecar bridge first; do not create new browser storage keys or env knobs.
