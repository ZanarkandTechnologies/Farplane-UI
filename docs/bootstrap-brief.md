# Bootstrap Brief

Existing-project migration brief for aligning Farplane UI with the current
`deep-init-project` operating standard.

## Project Profile

- Profile: coding app with a substantial browser UI, CLI, local state bridge,
  realtime backend, and runtime adapters.
- Lifecycle route: existing-project migration.
- First migration slice: add durable architecture, QA, hook, and pre-push
  surfaces without rewriting the backlog.
- Downstream handoff: `impl-plan -> impl` against one ticket at a time.

## Product Direction

Farplane is the Zanarkand Labs product shell for operating AI work from one
office. Codex is the default v0 runtime adapter for local projects and threads.
OpenClaw remains an optional adapter/gateway path for persistent agent
customization, channels, and isolated workspaces.

## Runtime And State Decisions

- Farplane-owned sidecar state lives under `~/.farplane`.
- OpenClaw-owned runtime state lives under `~/.openclaw` and is consumed only
  through the OpenClaw adapter.
- Codex office visibility lives under the `codex` key in `~/.farplane/office.json`.
- Codex project threads map to project tables, with recent threads as temporary
  employees and pinned/heartbeat threads kept visible.

## Canonical Commands

- Install: `npm install`
- App-only local run: `npm run ui`
- CLI: `npm run cli -- <command>`
- Root build gate: `npm run build`
- UI production build gate: `npm run ui:build`
- Lint: `npm run lint`
- Tests: `npm run test:once`
- Full typecheck target: `npm run typecheck`

## Hook Policy

- Local hooks are opt-in.
- The repo should recommend `pre-push` as the main local gate.
- `pre-commit` remains optional and should stay fast if enabled.
- Hooks must call repo-local scripts rather than embedding policy directly.
- Activation is a human choice:
  `git config core.hooksPath .githooks`.

## Current Gate Reality

Required pre-push gates now:

- `npm run build`
- `npm run ui:build`

Advisory until follow-up cleanup:

- `npm run lint`, currently blocked by one known `noUnsafeFinally` issue in
  `ui/src/components/hud/furniture-shop.tsx`.
- `npm run test:once`, currently needs Vitest alias/test-environment cleanup for
  UI `@/` imports when run from the root.
- `npm run typecheck`, currently blocked by broader UI type debt.

Target strict pre-push gate after cleanup:

- `npm run lint`
- `npm run typecheck`
- `npm run test:once`
- `npm run build`
- `npm run ui:build`

## QA Policy

- `qa/` is the durable QA entrypoint.
- Existing `docs/how-to/*` runbooks remain useful references and are linked
  from `qa/cookbook/*`.
- Stable browser regression should graduate to Playwright.
- `agent-browser` remains the discovery/debug/evidence lane for new or brittle
  flows.
- UI tickets must define fast entry, test hook, stabilization path, inspect
  path, expected artifacts, and evidence reconciliation.

## Agent Experience And Testability

Preferred helpers:

- Office command palette and panel shortcuts.
- Dev-only `window.__FARPLANE_QA__` panel bridge.
- Dev-only office click probe and clickability measurement script.
- Deterministic local sidecar templates under `templates/sidecar`.
- Browser evidence under ticket artifacts or `docs/research/qa-testing` until
  ticket-local artifact storage is standardized across all active tickets.

## Human Gates

Ask before:

- enabling git hooks globally or changing `core.hooksPath`
- deploying
- mutating production/remote OpenClaw or Convex state
- spending money or provisioning paid services
- deleting sidecar/runtime data outside an explicit cleanup ticket
- using credentials or changing secrets

## Follow-Up Tickets To Create

- Fix lint debt so `npm run lint` can become required pre-push.
- Fix root Vitest alias/environment so `npm run test:once` can become required
  pre-push.
- Drain full UI typecheck debt so `npm run typecheck` can become required.
- Refactor the largest source files and then enable strict large-file blocking.
