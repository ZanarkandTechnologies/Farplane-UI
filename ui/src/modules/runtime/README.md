# Runtime Module

## Purpose

Runtime selection and adapter wiring for the Farplane office. This module owns
the React provider, runtime adapter factory/contracts, Codex app-server bridge
client, and adapter-facing exports consumed by app surfaces.

Codex is the default runtime. OpenClaw remains an optional runtime adapter for
persistent agents, custom workspaces, scheduler/channel features, and gateway
operations.

## Public API

- `RuntimeAdapterProvider`
- `useOfficeRuntimeAdapter`
- runtime adapter kind/capability helpers
- Codex app-server client and normalizers

Import from `@/modules/runtime` unless a file is inside this module and needs a
private relative import.

## Boundaries

- Keep runtime-generic UI/provider names free of OpenClaw-specific labels.
- Keep OpenClaw-specific state/model contracts under
  `ui/src/modules/runtime/lib/openclaw/`.
- Keep Codex app-server bridge code module-local because it exists to feed the
  Codex runtime adapter.
- Do not add product panels here unless they configure or display runtime state.

## Codex Thread Status

- Office-wide employee loader state should come from cheap `thread/list`
  polling through `CodexRuntimeAdapter.getAgentsLiveStatus()`.
- `thread/read({ includeTurns: true })` is for an opened session timeline or
  reconciliation, not for roster polling.
- Focused live chat should rejoin only the selected thread with
  `thread/resume({ threadId })`, reduce app-server notifications into the same
  `AgentLiveStatus` shape, and fall back to `thread/list` / `thread/read` on
  reconnect.
- Browser UI should consume this through the Farplane runtime/gateway boundary;
  Three.js office components should only receive normalized employee fields.

## Test

```bash
npm run --workspace @farplane/ui build --
npm run build
```
