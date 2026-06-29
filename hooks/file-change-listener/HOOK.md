---
name: file-change-listener
description: "Codex PostToolUse hook that turns tracked Farplane file edits into typed file events and compact bubble summaries."
metadata: { "codex": { "events": ["PostToolUse"], "statusMessage": "Capture tracked Farplane file update" } }
---

# File Change Listener Hook

Captures tracked project file edits after write-capable tools. The hook now
publishes typed `farplane.*` file events for durable timeline and automation
subscribers, while preserving compact `file.change.summary` hook telemetry for
office head bubbles.

Tracked files include progress/goals files, ticket files, selected docs, evals,
and skill memory files. The hook bounds file/tool snippets before summarization
and never publishes raw `file.changed` telemetry by default.

Typed file events:

- `tickets/TASK-*/ticket.md` emits `farplane.ticket.changed`, or
  `farplane.ticket.completed` when terminal frontmatter flips to done/complete.
- `tickets/TASK-*/program.md` emits `farplane.ticket.program.changed`.
- `tickets/TASK-*/progress.md` emits `farplane.ticket.progress.changed`.
- `farplane/goals.md`, `products.md`, `harness.md`, `automations.md`, and
  `bindings.md` emit their matching `farplane.*.changed` events.
- `farplane/*.json` emits `farplane.config.changed`.
- `docs/MEMORY.md`, `LESSONS.md`, `TROUBLES.md`, `HISTORY.md`, and `TASTE.md`
  emit memory, learning, history, and taste events.

Payload privacy:

- Event payloads include compact field previews/hashes, changed field names,
  section hints, content hash, entity ids, and terminal flags.
- Event payloads do not include raw file bodies, raw diffs, prompts,
  transcripts, tool output, or routing/job instructions.
- Local parser snapshots are stored under `.farplane/file-events/state/` so the
  next hook run can compute frontmatter and JSON field diffs.
- Future provider webhooks can publish the same normalized event shape with
  `source=provider_webhook`, `provider`, and `externalId`.

Codex summary controls:

1. `FARPLANE_FILE_CHANGE_SUMMARY_MODEL`, default `gpt-5.4-mini`.

The hook intentionally assumes the installed `codex` CLI. If summarization
fails, it skips the file-change event instead of publishing a noisy fallback.

Watched path precedence:

1. `FARPLANE_FILE_CHANGE_PATTERNS`, separated by commas or newlines.
2. Project config at `.farplane/hooks/config.json`.
3. `farplane/manifest.json` tracked files.
4. Built-in progress/docs/ticket defaults.

Patterns are project-relative globs such as `progress.md`, `docs/**/*.md`, and
`tickets/*/progress.md`.

Failed telemetry publishes are queued under `.farplane/hooks/outbox.jsonl` and
replayed by later hook runs.
