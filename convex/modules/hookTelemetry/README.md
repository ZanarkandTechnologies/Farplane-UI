# Hook Telemetry Module

Canonical raw hook telemetry for Farplane.

This module stores one append-only raw hook log. Runtime analytics, skill
invocation dashboards, file-change notifications, and office bubbles should be
derived projections over this table instead of separate raw telemetry tables.

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

## Migration

Legacy skill invocation and runtime telemetry rows were backfilled into
`hookTelemetryEvents` before the old raw tables were removed from the Convex
schema. New imports and hooks write directly to `/telemetry/hooks` or
`/telemetry/hooks/batch`.
