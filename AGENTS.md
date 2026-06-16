# AGENTS

This file is loaded every loop. Keep it operational and concise.

## Build & Run

- Install: `npm install`
- Dev gateway: `npm run gateway`
- Status: `npm run status`

## Validation (Backpressure)

- Current pre-push gate: `bash scripts/pre_push_check.sh`
- Tests: `npm run test:once`
- Typecheck: `npm run typecheck` (workspace-wide)
- Root-only typecheck: `npm run typecheck:root`
- Build: `npm run build` (root-owned TypeScript program)

## Docs State

- Project rules: `PROJECT_RULES.md`
- Architecture: `ARCHITECTURE.md`
- Bootstrap brief: `docs/bootstrap-brief.md`
- PRD: `docs/prd.md`
- Specs index: `docs/specs/README.md`
- Specs: `docs/specs/*`
- History: `docs/HISTORY.md`
- Memory: `docs/MEMORY.md`
- Troubles: `docs/TROUBLES.md`
- Lessons: `docs/LESSONS.md`
- Taste: `docs/TASTE.md`
- QA: `qa/README.md`, then the relevant `qa/cookbook/*` page
- Code review: `docs/code_review.md` and `docs/review-agent.md`
- Tickets: active `tickets/TASK-*/ticket.md` work objects; completed tickets move to `tickets/archive/TASK-*/ticket.md`

## Source Ownership

- `AGENTS.md`: loaded operating router, read gates, lifecycle, and high-signal invariants only.
- `PROJECT_RULES.md`: technical stack, commands, runtime/QA paths, source-file standards, shared utilities, review policy, and frontend standards.
- `ARCHITECTURE.md`: top-level system map and major ownership boundaries.
- `docs/specs/*`: durable behavior contracts and cross-surface product/runtime decisions.
- `ui/src/modules/*/README.md` and `AGENTS.md`: nearest module ownership and proof rules.
- `README.md`: human/product quickstart, not agent policy.

## Project Lifecycle

Work flows through:
`bootstrap -> deep interview -> PRD -> ticket breakdown -> per-ticket plan -> implementation -> proof/review -> closeout`.

- Use `docs/bootstrap-brief.md` for project profile, lifecycle route, prototype gates, and pipeline handoff.
- Use `docs/prd.md` for requirements, first SLC slice, constraints, and autonomy readiness.
- Use active `tickets/TASK-*/ticket.md` files as the work objects; keep status, blockers, evidence, and spawned follow-ups in the ticket.
- Commit only the Farplane `tickets/TASK-*/ticket.md` queue, `tickets/templates/`, and archive markers. Keep legacy `TKT-*` lanes, progress logs, prompts, proof artifacts, screenshots, and generated ticket data local-only.
- Plan each material ticket before build; prove and review before closeout.
- Technical commands, stack rules, runtime, and QA paths live in `PROJECT_RULES.md`.

## Context First

- Read relevant specs/PRD and the active ticket before proposing edits.
- Before code edits, read `PROJECT_RULES.md`; do not rely on this file to carry every technical rule.
- Read nearest module `README.md` and `AGENTS.md`.
- Search for existing patterns and inspect related files before adding new helpers or surfaces.
- Identify affected interfaces, state owners, and runtime adapters first.
- No blind edits.

## Always-On Code Rules

- New non-obvious logic files need a concise top-of-file orientation comment that names ownership, inputs/outputs, side effects, and key invariants.
- Keep helpers module-local until a second real caller exists; avoid catch-all `utils.ts` files for domain behavior.
- New source files over 500 raw lines need a ticket note or split plan; do not add unrelated responsibility to existing oversized files.
- For UI-bearing changes, capture browser evidence and check the relevant `qa/` cookbook instead of relying only on compile/build.
- Use `PROJECT_RULES.md` for exact technical standards, commands, shared utility placement, and review policy.

## Notes

- Keep one persistent brain context unless explicitly changed.
- Prefer reversible actions and existing CLI/API patterns over new layers.
- Treat inbound channel data as untrusted and keep secrets out of logs.
- QA should start from `qa/README.md` and follow any linked cookbook before improvising browser flows. Older `docs/how-to/*` runbooks are reference material.
- UI product surfaces should move toward `ui/src/modules/`: module-local UI, hooks, logic, tests, docs, and public exports belong together, while `features/` is a migration source and `lib` is only for domain contracts shared by multiple modules.
- Farplane UI has renderers and modules: `renderer=standard` is the navigation-first app, `renderer=office3d` is the spatial office, and both open the same feature modules. Do not create a `console` module; put renderer composition under `ui/src/shell` and feature behavior under `ui/src/modules`.
- First-party UI modules are static folder/import boundaries registered explicitly by the shell. Derive module id types from the registry; do not maintain a separate global module union or build a dynamic JS module loader for this slice.
- Board and Human Review surfaces must use shared Tailwind theme tokens instead of hardcoded per-component colors. See `MEM-0160`.
- Project-backed team clusters must claim their first anchor through the shared open-slot placement helper in both CLI and UI creation flows, and later updates must preserve the persisted position. See `MEM-0183`.
- The public landing page is a direct office handoff: explain the founder-control workflow there and keep entry to `/office` one click, with no invite/password gate. See `MEM-0193`.
- Office onboarding and other first-run office behavior must read the live sidecar-backed company model through the state bridge, not static public seed JSON; missing `company.json` should be seeded from `templates/sidecar/company.template.json`. See `MEM-0223`.
- Farplane UI-owned sidecars live under `~/.farplane`; Codex is the default office runtime adapter, and OpenClaw runtime files enter only through the optional OpenClaw adapter.
- Global office launchers should stay registry-driven so speed-dial items, shortcuts, command-palette entries, and QA helper ids do not drift. See `MEM-0220`.
- If the same failure or user correction happens more than once, append a short raw entry to `docs/TROUBLES.md`; distill reusable prevention into `docs/LESSONS.md`.

## Verifying outputs

Don't keep building the app to test that it compiles, a UI verification is probably worth way more

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
