---
owner: hook-telemetry
status: active
updated: 2026-06-17
---

# Hook Telemetry Feature Registry

## Surface

`RawTelemetryPanel` is the operator-only raw hook telemetry explorer opened from
the office launcher entry `raw-telemetry`.

## Capabilities

- Event log: reads `hookTelemetryEvents` through
  `api.modules.hookTelemetry.queries.getHookTelemetryExplorer` and renders
  bounded rows with hook name, hook type, event name, session, time, and redacted
  payload preview.
- Distributions: renders top event names, hook names, hook types, and sessions
  for the current filtered window.
- Hooks setup: shows the canonical install command, `/hooks` trust reminder, and
  a default watcher-pattern preview. Runtime overrides are owned by
  `FARPLANE_FILE_CHANGE_PATTERNS`.
- Access control: launcher action is hidden in read-only modes; the panel also
  skips the Convex query and renders a locked state when opened outside operator
  mode.
- Convex disabled: renders an unavailable state without attempting hook-event
  queries.

## Non-Goals

- Does not calculate runtime agent-hours. That belongs to the Harness Usage
  module under `ui/src/modules/telemetry`.
- Does not render raw unredacted hook payloads by default.
- Does not mutate hook config from the browser. Hook installation and runtime
  pattern overrides stay CLI/local through `npm run hooks:install`,
  `FARPLANE_FILE_CHANGE_PATTERNS`, and Codex `/hooks` trust.
