# Architecture

Current-state system map for Farplane UI, the cockpit for the Farplane
cloneable harness.

## Purpose

Farplane is the cloneable harness substrate for operating AI work: skills,
evals, standards, templates, tickets, automations, runtime adapters, goals,
guardrails, and self-improvement loops. Farplane UI is the browser cockpit over
that harness.

The top-level split is:

- **Global harness surfaces**: maintain and inspect the harness itself, such as
  Harness Map, Skill OS, Eval OS, Rollout, Template Tracking, User Comms, and
  Settings.
- **Project/company surfaces**: treat each selected project as an autonomous
  company with goals, teams, agents, files, board state, memory, evidence,
  metrics, and review loops.

The repo owns the UI, CLI, local state bridge, sidecar templates,
Convex-backed realtime surfaces, and in-repo extensions/skills that make the
harness and office useful. The product model is defined in
`docs/features/FEAT-0002-harness-product-model.md`.

## Canonical Surfaces

- `AGENTS.md`: operational loop rules and read order.
- `PROJECT_RULES.md`: stack, commands, QA paths, pre-push policy, and shared
  utility conventions.
- `README.md`: product story, setup, runtime model, and quickstart.
- `docs/bootstrap-brief.md`: existing-project migration decisions and current
  lifecycle route.
- `docs/features/README.md`: feature/capability spec index.
- `docs/systems/README.md`: system/product-layer grouping index.
- `tickets/README.md`: execution contract and ticket lifecycle.
- `qa/README.md`: durable QA and evidence-capture policy.

## Main Surfaces

- `ui/`: Vite/React office UI, local state bridge routes, and runtime adapter
  integration.
- `cli/`: Farplane CLI for onboarding, office/team commands, runtime checks,
  and operator workflows.
- `convex/`: realtime backend contracts for status, board, timeline, and shared
  memory surfaces.
- `extensions/`: first-party runtime extensions, currently including the Notion
  comment bridge.
- `skills/`: repo-local skill packages and sync/install flows.
- `templates/`: sidecar and bootstrap defaults for local Farplane state.
- `docs/`: durable product, architecture, spec, history, taste, trouble, and
  lesson state.
- `qa/`: reusable browser QA entrypoints, cookbook pages, shortcuts, probes,
  and evidence expectations.
- `tickets/`: active filesystem board and archived execution history.
- `scripts/`: repo-local validation, diagnostics, and operational helpers.

## Runtime Model

Farplane UI has two runtime adapter lanes:

- `codex`: default v0 adapter. Codex projects and threads are mapped through
  the local state bridge into office teams, temporary workers, sessions, and
  kanban/ticket context.
- `openclaw`: optional adapter for persistent agent customization, gateway
  integrations, and isolated workspaces when that extra runtime layer is needed.

Farplane-owned local product state lives under `~/.farplane`. OpenClaw-owned
runtime state remains under `~/.openclaw` and enters Farplane through the
OpenClaw adapter.

## Read Order

1. `AGENTS.md`
2. `PROJECT_RULES.md`
3. `ARCHITECTURE.md`
4. `docs/bootstrap-brief.md`
5. `qa/README.md` and the relevant `qa/cookbook/*` page for UI work
6. Active ticket plus `tickets/README.md`

## Current Limits

- The full workspace `npm run typecheck` has known UI type debt. Use
  `PROJECT_RULES.md` for the current required versus target gates.
- Browser QA is still maturing from `agent-browser` proof toward stable
  Playwright regression coverage.
- Large source files predate the current scaffold standard. The pre-push script
  reports them now and can be made strict once refactor tickets drain the list.
