# Hook Telemetry Module

Canonical raw hook telemetry for Farplane.

This module stores one append-only raw hook log. Runtime analytics, skill
invocation dashboards, file-change notifications, thread-lineage graphs, and
office bubbles should be derived projections over this table instead of
separate raw telemetry tables.

## Model

- Project files own durable history and memory.
- `hookTelemetryEvents` owns hook-originated runtime observations.
- Feature modules own interpretation and UI projections.

## Core Fields

- `hookName`: Farplane-maintained producer name.
- `hookType`: raw lifecycle hook name, such as `PostToolUse` or `Stop`.
- `projectId`: optional Farplane project/team grouping.
- `sessionId`: optional Codex/OpenClaw session identity.
- `payload`: sanitized hook-specific data.
- `eventAt`: event time.
- `eventKey`: optional dedupe key.

## Repo-Managed Codex Hooks

`npm run hooks:install` writes the repo-local `.codex/hooks.json` config for
these opt-in Codex hooks:

- `skill-invocation-listener`: `PostToolUse`; records successful `SKILL.md`
  reads as `skill.invoked` metadata.
- `file-change-listener`: `PostToolUse`; summarizes selected tracked file
  writes as `file.change.summary`.
- `thread-lineage-listener`: `PostToolUse`; records `create_thread` and
  `fork_thread` results as `thread.created` and `thread.forked` lineage
  metadata.

The managed hooks must remain compact and diagnostics-oriented. They may write
bounded metadata to `/telemetry/hooks`, queue failed sends in
`.farplane/hooks/outbox.jsonl`, and require explicit `/hooks` trust in Codex.
They must not persist raw prompts, transcripts, full tool output, or private
Codex storage snapshots.

## Migration

Legacy skill invocation and runtime telemetry rows were backfilled into
`hookTelemetryEvents` before the old raw tables were removed from the Convex
schema. New imports and hooks write directly to `/telemetry/hooks` or
`/telemetry/hooks/batch`.
