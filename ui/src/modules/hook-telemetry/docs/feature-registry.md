---
owner: hook-telemetry
status: active
updated: 2026-06-25
---

# Hook Telemetry Feature Registry

## Surface

`RawTelemetryPanel` is the operator-only Project Timeline explorer opened from
the office launcher entry `raw-telemetry`.

## Capabilities

- Timeline events: reads `hookTelemetryEvents` through
  `api.modules.hookTelemetry.queries.getHookTelemetryExplorer` and renders
  bounded rows with hook name, hook type, event name, session, time, and redacted
  payload preview.
- Hooks: renders a per-project hook control center with hook package list,
  file-change listener config, active pattern count, manifest file selection,
  summary-bubble toggle, install action, and recent event preview.
- Event Programs: renders non-executing routing previews for event-to-mining
  program subscriptions such as `farplane.ticket.completed` to
  `ticket-completion-audit-v1`.
- Raw: preserves the raw event table escape hatch for operator debugging.
- Distributions: renders top event names, hook names, hook types, and sessions
  for the current filtered window.
- Hooks setup: writes project-local `.farplane/hooks/config.json` through the
  Vite state bridge and runs the global Codex hook installer on request.
- Thread telemetry: `thread.created` and `thread.forked` rows remain available
  through Events and Distributions; Raw Telemetry does not expose a separate
  thread lineage tab.
- Access control: launcher action is hidden in read-only modes; the panel also
  skips the Convex query and renders a locked state when opened outside operator
  mode.
- Convex disabled: renders an unavailable state without attempting hook-event
  queries.

## Non-Goals

- Does not calculate runtime agent-hours. That belongs to the Harness Usage
  module under `ui/src/modules/telemetry`.
- Does not schedule event programs yet.
- Does not render raw unredacted hook payloads by default.
- Does not auto-trust Codex hooks. Installation writes repo-local hook config,
  but the operator still reviews and trusts hook changes through `/hooks`.
