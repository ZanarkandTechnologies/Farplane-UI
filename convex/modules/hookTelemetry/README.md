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
- `farplane-console-ping`: `UserPromptSubmit`, `Stop`, `SubagentStart`, and
  `SubagentStop`; records sanitized root/subagent lifecycle, resolves native
  Codex names and display-only ticket bindings for root threads, records title
  provenance, runtime classification, and `thread.spawned` lineage.
- `codex-event-miner`: `Stop`; keeps local miner window state, launches
  detached Codex event-mining agents on cadence, records miner lifecycle events,
  and flushes completed miner-agent report summaries as `learning.*` /
  `decision.observed` fallback metadata.

The managed hooks must remain compact and diagnostics-oriented. They may write
bounded metadata to `/telemetry/hooks`, queue failed sends in
`.farplane/hooks/outbox.jsonl`, and require explicit `/hooks` trust in Codex.
They must not persist raw prompts, transcripts, full tool output, or private
Codex storage snapshots.

Office presence is a hook-derived projection over the most recent five
minutes. Convex and local hook rows are merged by worker identity, expiry is
computed from the observation time, eval-purpose rows are excluded, and only
root non-ephemeral conversations become roster employees. Native subagents
remain typed lineage/transient effects instead of durable employees or desks.
Codex app-server connectivity is optional control infrastructure, not a
requirement for rendering presence.

Observed titles use explicit provenance: `native > ticket > hook > agent >
fallback`. A newer lifecycle row supplies current state and freshness but cannot
downgrade a stronger title; a newer title at the same provenance replaces the
older one. The publisher never sends the user prompt, transcript, rollout
contents, or an absolute ticket path. A native rename reaches this projection
on the next lifecycle hook.

## Migration

Legacy skill invocation and runtime telemetry rows were backfilled into
`hookTelemetryEvents` before the old raw tables were removed from the Convex
schema. New imports and hooks write directly to `/telemetry/hooks` or
`/telemetry/hooks/batch`.
