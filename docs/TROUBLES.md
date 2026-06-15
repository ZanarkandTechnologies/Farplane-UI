# TROUBLES

Append-only log for repeated failures, user corrections, and preventable misses.

Format:
`YYYY-MM-DD HH:mm Z | area,tags | request | miss | correction | prevention`

Promote only durable lessons from here into `docs/MEMORY.md` or the relevant skill/contract.

2026-06-15 17:06 Z | telemetry,hooks,codex | Telemetry tab had no recent events and Codex locks looked suspicious | Global Farplane Console ping hooks ran without `FARPLANE_CONVEX_SITE_URL` in the Codex app-server environment, and clean-env execution resolved a Python with broken HTTPS certificates; live Convex ingestion stopped while local Codex/session logs still captured recoverable rows | Updated `~/.codex/hooks.json` to source `~/.codex/config.local.env` before the ping hook and pin `/opt/homebrew/bin/python3`; backfilled `2026-06-14` onward with `npm run telemetry:import:aikage -- --since 2026-06-14 --site-url https://friendly-magpie-825.convex.site` | Hook smoke must be tested from a clean env and verified in Convex; importer runs should pass an explicit `--site-url` when shell env is not guaranteed.
