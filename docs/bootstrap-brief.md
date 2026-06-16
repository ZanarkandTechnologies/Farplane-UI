# Bootstrap Brief

Existing-project migration brief for aligning Farplane UI with the current
`deep-init-project` operating standard.

## Project Profile

- Profile: coding app with a substantial browser UI, CLI, local state bridge,
  realtime backend, and runtime adapters.
- Lifecycle route: existing-project migration.
- First migration slice: add durable architecture, QA, hook, pre-push,
  Farplane config, runtime-state, and starter PRD-ticket surfaces without
  rewriting the legacy backlog.
- Downstream handoff: `impl-plan -> impl` against one ticket at a time.

### Coding-App Components

- goal: founder-control office for AI work
- user/workflow: operator opens `/office`, inspects teams, reviews artifacts,
  and coordinates runtime-backed agents
- data model: local Farplane sidecars, optional OpenClaw gateway state, Convex
  realtime modules, and markdown-first work artifacts
- screens/routes: office, module shell, runtime/settings, team workspace,
  review board, skill/eval/resource/telemetry modules
- backend/API: Node CLI, Vite state bridge routes, Codex app-server adapter,
  OpenClaw adapter, Convex modules
- auth/permissions: local operator-first defaults; external credentials and
  remote mutations remain explicit human gates
- observability: runtime panels, telemetry modules, QA bridge, review packets,
  and `.farplane/reviews/`
- testability: QA cookbook, browser evidence bundles, dev-only probes,
  Vitest/Playwright where stable
- deploy/runtime: local npm workspace first; Convex/OpenClaw only when the
  tested feature needs them
- proof: pre-push gates, QA reports, screenshots/snapshots, and reviewer lane
  output for material changes

### Advice Axes

- product slice options: prioritize one vertical operator workflow over broad
  backlog conversion
- architecture/topology options: keep the current npm workspace monorepo and
  avoid new wrappers unless they reduce real runtime ambiguity
- data ownership options: Farplane sidecars own Farplane UI state; OpenClaw and
  Convex remain adapter-backed external systems
- UI workflow options: favor deterministic module entrypoints, shortcuts, and
  QA probes for canvas-heavy flows
- testability/proof options: use `agent-browser` for discovery/evidence and
  Playwright only after a path is stable
- deploy/runtime options: keep local hooks opt-in; treat deploy, paid services,
  credentials, and remote state mutation as human gates

### Prototype Gates

- riskiest integration: Codex app-server project/thread adapter and optional
  OpenClaw runtime adapter must be proven on one representative office flow
- unknown UI workflow: canvas-heavy office interactions need shortcuts, DOM
  mirrors, or probes before broad automation
- unknown data model: any sidecar or Convex shape change needs one narrow
  migration/proof before broader rollout
- hard-to-QA surface: visual, 3D, or runtime-backed panels need browser
  evidence before closeout

## Product Direction

Farplane is the Zanarkand Labs product shell for operating AI work from one
office. Codex is the default v0 runtime adapter for local projects and threads.
OpenClaw remains an optional adapter/gateway path for persistent agent
customization, channels, and isolated workspaces.

## Runtime And State Decisions

- Tracked Farplane project config lives under `farplane/`, with
  `farplane/manifest.json` recording spec version `1.1.0`.
- Ignored Farplane runtime state lives under `.farplane/`, including run
  ledgers, reports, eval runs, logs, and review packets.
- The active tracked Farplane ticket queue uses `tickets/TASK-*/ticket.md`.
  Legacy `TKT-*` lane folders remain local-only reference state.
- Starter PRD handoff: `tickets/TASK-0001/ticket.md`, which asks for a review
  of the existing `docs/prd.md` before any fresh PRD pass.
- Farplane-owned sidecar state lives under `~/.farplane`.
- OpenClaw-owned runtime state lives under `~/.openclaw` and is consumed only
  through the OpenClaw adapter.
- Codex office visibility lives under the `codex` key in `~/.farplane/office.json`.
- Codex project threads map to project tables, with recent threads as temporary
  employees and pinned/heartbeat threads kept visible.

## UI Bootstrap Decision

This is an existing Vite/React/Tailwind app, so bootstrap should not re-run a
greenfield shadcn or tweakcn setup. New UI should keep using the existing
module system, shared Tailwind theme tokens, shadcn-style primitives where they
already exist, and `docs/TASTE.md` plus browser evidence for visual changes.

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
- Local Codex SDK diff review is installed and should run in `pre-push` as an
  advisory second pair of eyes by default. Set `STRICT_AGENT_REVIEW=1` only
  when the repo is ready to make that lane blocking.
- The reusable `code-review` skill is expected at
  `~/.codex/skills/code-review/SKILL.md` for the local diff reviewer. If it is
  unavailable, the review runner should skip with setup guidance instead of
  blocking.
- CodeRabbit and `desloppify` are optional heavier/manual workflows for v1, not
  required local hook gates.
- No separate CI/deploy gate is configured in this bootstrap slice; deploy
  protection remains a human-owned decision until a CI surface is added.

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
- `qa/artifacts/` is local scratch evidence and should not be committed.

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
- adding or changing credentials, tokens, or secrets
- deploying
- mutating production/remote OpenClaw or Convex state
- spending money or provisioning paid services
- deleting sidecar/runtime data outside an explicit cleanup ticket
- destructive filesystem or Git operations

## Scaffold Decision Boundaries

- Auto-decide: docs/QA scaffold completion, tracked `farplane/` config,
  ignored `.farplane/` runtime state, tracked `TASK-*` ticket substrate,
  local ignore rules for legacy tickets and scratch evidence, repo-local
  validation scripts, and advisory review wiring.
- Ask first: architecture/topology rewrites, public API/data-model changes,
  migrations, hook activation, CI/deploy setup, credentials, paid compute, and
  destructive cleanup.

## Follow-Up Tickets To Create

- Fix lint debt so `npm run lint` can become required pre-push.
- Fix root Vitest alias/environment so `npm run test:once` can become required
  pre-push.
- Drain full UI typecheck debt so `npm run typecheck` can become required.
- Refactor the largest source files and then enable strict large-file blocking.
