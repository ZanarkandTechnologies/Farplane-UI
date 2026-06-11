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

## Test

```bash
npm run --workspace @farplane/ui build --
npm run build
```
