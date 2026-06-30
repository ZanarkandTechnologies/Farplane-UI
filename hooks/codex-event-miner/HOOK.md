# Codex Event Miner Hook

`codex-event-miner` is a repo-managed Codex `Stop` hook that launches compact
event-mining agents.

It is intentionally not a chat-history backfill service and it does not mine
decisions inline. On each Stop payload it does bounded launcher work:

- update per-session miner window state under `.farplane/event-miner/windows/`
- when due, emit `miner.agent.queued` from the miner cadence, defaulting to 5
  turns
- when due, spawn a detached `codex exec` miner agent with program instructions
  for `decision-v1` and `learning-docs-v1`
- the agent reads the referenced Codex transcript/session, extracts schema-shaped
  events, and writes a local report under `.farplane/event-miner/runs/`
- flush completed miner-agent `report.json` files from
  `.farplane/event-miner/runs/` into telemetry rows through the hook publisher
- when verbose telemetry is enabled, also emit cadence bookkeeping rows:
  `miner.window.updated` and `miner.agent.skipped`

Only the hook publishes through `/telemetry/hooks` using the shared telemetry outbox.
Payloads must stay compact and must not include raw prompts, transcripts, full
assistant messages, full docs rows, or tool output.

Configuration:

- `FARPLANE_EVENT_MINER_CADENCE_TURNS`: positive integer, default `5`
- `FARPLANE_EVENT_MINER_VERBOSE_TELEMETRY=1`: publish per-Stop cadence
  bookkeeping rows for debugging
- `FARPLANE_EVENT_MINER_DRY_RUN=1`: write the miner run packet without spawning Codex
- `FARPLANE_EVENT_MINER_HOOK_DEBUG=1`: print debug counters to stderr
- `FARPLANE_CONVEX_SITE_URL` or `CONVEX_SITE_URL`: telemetry endpoint base URL
- `FARPLANE_TELEMETRY_TOKEN`: optional ingest token
