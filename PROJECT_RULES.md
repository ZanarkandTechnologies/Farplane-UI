# Project Rules: Farplane

This file defines project-specific technical rules, stack details, and execution conventions.

## Tech Stack

- Frameworks: Node.js CLI workspace + Vite/React UI workspace
- Language: TypeScript (strict)
- Backend: Convex + OpenClaw gateway/state bridge integration
- State: Zustand
- Package manager: npm workspaces
- Test runner: Vitest
- Lint/format: Biome

## Folder Structure

- `ARCHITECTURE.md`: top-level system map and canonical surface guide
- `cli/`: packaged Farplane CLI workspace
- `convex/`: realtime backend functions and schema
- `extensions/`: in-repo OpenClaw plugins and adapters
- `skills/`: repo-local skill source packages for sync/install flows
- `ui/`: Vite/React office UI workspace
- `docs/`: canonical project state (`bootstrap-brief.md`, `prd.md`, `features/FEAT-*.md`, `systems/*.md`, `HISTORY.md`, `MEMORY.md`, `TROUBLES.md`, `LESSONS.md`, `TASTE.md`)
- `qa/`: reusable browser QA runbooks, cookbook pages, shortcuts, probes, and evidence expectations
- `farplane/`: tracked Farplane project config (`manifest.json`, `harness.yaml`, `metrics.yaml`, `automations.toml`, `bindings.yaml`, hooks, PM thread manifest)
- `.farplane/`: ignored local runtime state, automation state, reports, eval runs, logs, content ledgers, metric observations, and project UI snapshots
- `tickets/`: tracked Farplane ticket queue (`TASK-*/ticket.md`, `archive/`, `templates/`); legacy `TKT-*` lanes are local-only

## UI Modularity Rules

- Treat `ui/src/shell/` as the renderer-composition boundary. Supported
  renderer names are `standard` for navigation-first web UI and `office3d` for
  the spatial office UI.
- Do not model Console as a module. The standard renderer and the office3d
  renderer should open the same feature modules through different entry
  surfaces.
- Treat `ui/src/modules/` as the target home for reusable operator workflows
  and route-mounted product surfaces.
- Model modules around operator jobs, not file type: office, runtime,
  team-workspace, agent-workspace, skills-studio, chat, settings, and qa-tools.
- Keep module components, hooks, local logic, tests, fixtures, and docs inside
  the owning module.
- Export intentional public surfaces through each module's `index.ts`.
- Keep helpers local until there is a second real caller.
- Promote cross-module contracts into domain-named `ui/src/lib/<domain>/`
  folders rather than catch-all utility files.
- Register first-party modules through static imports in the shell registry and
  derive module id types from that registry rather than maintaining a separate
  global union.
- Do not introduce `packages/` until at least two workspace apps import the
  same shared library.
- Keep runtime-specific code behind runtime adapter folders or module-local
  runtime panels; OpenClaw-specific UI/library code belongs under `openclaw/`
  or the OpenClaw adapter path.
- Use `features/` as a migration source for existing systems, but do not grow
  it for new product-sized surfaces.
- Substantial modules should include short `README.md` and `AGENTS.md` wrappers
  plus module-local `docs/feature-registry.md` and `docs/qa-runbook.md`.

## Conventions

- Naming: camelCase for functions/variables, PascalCase for types/classes/components
- Types: no `any`; explicit return types on exported APIs
- Testing: colocated Vitest tests for behavior changes; Playwright is the target for stable browser regression paths
- Documentation: update `docs/HISTORY.md` for material changes; promote durable rules to `docs/MEMORY.md`
- Workflow: `tickets/TASK-*/ticket.md` is the active Farplane board; legacy `tickets/{todo,building,review,done}/TKT-*` lanes and `docs/progress.md` are reference/local-only
- QA: use `qa/README.md` and `qa/cookbook/*` as the canonical QA entrypoint; older `docs/how-to/*` QA guides remain reference runbooks
- Security: treat inbound channel payloads as untrusted; keep secrets in env/secret resolvers and out of browser bundles/logs
- Shared utilities: prefer module-local helpers, domain-scoped `ui/src/lib`,
  or existing shared helpers before adding new helpers inside large components

## Source File Standards

- Add a concise top-of-file orientation comment to new non-obvious logic files:
  module entrypoints, runtime adapters, providers, systems, stores, Convex
  functions, scripts, and files whose responsibility is not obvious from the
  filename alone.
- Header comments should state ownership, inputs/outputs, side effects, and
  important invariants. Avoid boilerplate comments on tiny presentational
  components or files whose purpose is obvious.
- Complex logic inside functions should get short orienting comments before
  the branch/block. Do not narrate line-by-line mechanics.
- New source files over 500 raw lines need an explicit ticket note or a split
  plan. Existing large files may be touched narrowly, but do not add unrelated
  responsibility to them.
- When a file grows custom behavior, state, or variants, extract the owning
  feature/module instead of growing an oversized file.

## Shared Utilities

- Preferred shared utility location: domain-scoped `ui/src/lib/<domain>/` for
  UI cross-module contracts; module-local `lib/` for one-module helpers; CLI
  and extension helpers stay in their owning workspace unless reused.
- Extract when logic is reused across modules, would otherwise be copied, or is
  making feature files too large.
- Keep local when a helper is private to one module, coupled to one feature, or
  has only one caller.
- Do not add catch-all `utils.ts` files for domain behavior.

## Frontend UI Standards

- Persistent explanatory text in app chrome should become labels, tooltips,
  empty states, or progressive disclosure unless it is primary user content.
- UI-bearing tickets should capture browser evidence and check against
  `docs/TASTE.md` when visual layout, density, or interaction quality changes.
- Avoid nested scrolling in modal dashboards and dense app panels where the
  primary surface can instead fill the available height. Prefer compact controls,
  constrained side rails, and flex/grid `min-h-0` layouts before adding an
  inner scroll container.
- For standard app surfaces, prefer existing shadcn-style primitives and shared
  Tailwind theme tokens. For office surfaces, preserve the 3D office visual
  language and run browser QA for scene/HUD regressions.

## Review Policy

- Canonical material review uses the Farplane reviewer lane plus the TAS
  `review` skill for ticket completion, evidence bundles, prompts, skills,
  evals, or risky architecture changes.
- Local pre-push review uses `npm run review:prepush` through
  `scripts/pre_push_check.sh` as an advisory second pair of eyes by default.
- Use `FARPLANE_SKIP_AGENT_REVIEW=1` to skip local diff review and
  `STRICT_AGENT_REVIEW=1` to make it blocking.
- Review artifacts live under `.farplane/reviews/` and must not be committed.

## Runtime / QA Commands

- Authoritative app-only run path: `npm run ui`
- Authoritative QA/evidence run path: `npm run ui`, then follow the relevant `qa/cookbook/*` page
- Required local services: Codex app server for Codex project/thread data; OpenClaw gateway only when the OpenClaw adapter is selected; Convex when testing realtime status/board surfaces
- Launch shape: local npm workspace processes plus optional external runtime services
- Expected UI target: Vite prints the active URL; common local target is `http://127.0.0.1:5173`
- Port/env contract: keep Vite host/port configurable; `CODEX_APP_SERVER_URL` enables Codex app-server bridge data; gateway/state bridge URLs are user-configurable in Settings

## Pre-Push Policy

- Local hooks are opt-in; do not auto-enable `.githooks`.
- Recommended hook stage: `pre-push`.
- Current required local gates:
  - root build/typecheck: `npm run build`
  - UI production build: `npm run ui:build`
- Current advisory checks until known debt is cleaned up:
  - lint: `npm run lint`
  - tests: `npm run test:once`
  - full typecheck: `npm run typecheck`
- Target strict gate after cleanup:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:once`
  - `npm run build`
  - `npm run ui:build`
- Large source files warn at `500` raw lines and are reported at `1000` raw lines. Set `PRE_PUSH_STRICT_LARGE_FILES=1` only after the current oversized-file backlog is drained.
- Set `PRE_PUSH_STRICT_ADVISORY=1` after lint/test/typecheck are ready to block.

## Quick Commands

```bash
# Install dependencies
npm install

# Run the UI
npm run ui

# Run the current local pre-push gate
bash scripts/pre_push_check.sh

# Run the CLI
npm run shell -- status

# Run tests
npm run test:once

# Typecheck
npm run typecheck

# Lint
npm run lint

# Format check
npm run format:check

# Build
npm run build
```
