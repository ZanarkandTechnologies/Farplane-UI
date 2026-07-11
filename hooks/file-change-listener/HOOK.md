---
name: file-change-listener
description: "Codex PostToolUse adapter that hands raw file-change payloads to Farplane Core."
metadata: { "codex": { "events": ["PostToolUse"], "statusMessage": "Capture tracked Farplane file update" } }
---

# File Change Listener Hook

Hands raw PostToolUse payloads to `farplane mining handle-file-change`. Core
owns tracked-path policy, typed `farplane.*` event classification, dedupe,
route selection, run creation, reports, and durable delivery state. Convex
telemetry and legacy summary bubbles are optional mirrors only.

Tracked files are the ticket packet, project YAML/JSON config, and durable
project memory named by `farplane/hooks.json`. The hook never publishes raw
`file.changed` telemetry by default.

Core may emit typed file events such as:

- `tickets/TASK-*/ticket.md` emits `farplane.ticket.changed`, or
  `farplane.ticket.completed` when terminal frontmatter flips to done/complete.
- `tickets/TASK-*/program.md` emits `farplane.ticket.program.changed`.
- `tickets/TASK-*/progress.md` emits `farplane.ticket.progress.changed`.
- `farplane/*.{yaml,yml,json}` emits `farplane.config.changed`; this includes
  the canonical `harness.yaml`, `metrics.yaml`, `bindings.yaml`, and
  `hooks.json` surfaces.
- `docs/MEMORY.md` emits `farplane.memory.changed`.
- `docs/LESSONS.md` and `docs/TROUBLES.md` emit
  `farplane.learning.changed`.
- `docs/HISTORY.md` emits `farplane.history.changed`.

Payload privacy:

- Event payloads include compact field previews/hashes, changed field names,
  section hints, content hash, entity ids, and terminal flags.
- Event payloads do not include raw file bodies, raw diffs, prompts,
  transcripts, tool output, or routing/job instructions.
- Core stores parser snapshots and event/run state under project-local
  `.farplane/` paths; this UI hook does not maintain semantic snapshots.
- Future provider webhooks can publish the same normalized event shape with
  `source=provider_webhook`, `provider`, and `externalId`.

Legacy Codex summary controls:

AI-generated `file.change.summary` bubbles are disabled by default. Prefer
typed `farplane.*` events and deterministic UI labels.

To temporarily re-enable the legacy summarizer:

1. Set `~/.farplane/config.toml` `[hooks.file_change]` `summaryEnabled = true`, or set
   `FARPLANE_FILE_CHANGE_SUMMARY_ENABLED=1`.
2. Optionally set `FARPLANE_FILE_CHANGE_SUMMARY_MODEL`, default
   `gpt-5.4-mini`.
3. Optionally set `FARPLANE_FILE_CHANGE_SUMMARY_DEBOUNCE_MS`, default `8000`.
   Set to `0` to disable the trailing quiet-window debounce.

When enabled, the hook assumes the installed `codex` CLI, waits for the
per-file debounce window to settle, and only the latest pending change spawns
the local Codex summary helper.

Watched path precedence:

1. `FARPLANE_FILE_CHANGE_PATTERNS`, separated by commas or newlines.
2. Canonical local config at `~/.farplane/config.toml` `[hooks.file_change]`.
3. `farplane/manifest.json` tracked files.
4. Built-in progress/docs/ticket defaults.

Patterns are project-relative globs such as `progress.md`, `docs/**/*.md`, and
`tickets/*/progress.md`.

`summaryDebounceMs` in `~/.farplane/config.toml` `[hooks.file_change]` controls the legacy
per-file quiet window. The debounce ledger stores timing and hashes only under
`.farplane/file-events/summary-debounce/`.

Core owns durable file-event and mining delivery. Failed optional telemetry
mirror publishes may still use the UI hook outbox.

Operator/runtime values, local secrets, and file-change hook behavior belong in
`~/.farplane/config.toml`. Tracked project files should not duplicate those
runtime settings.
