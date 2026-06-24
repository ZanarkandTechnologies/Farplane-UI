# Farplane UI

The cockpit for a cloneable AI harness.

Farplane is the cloneable harness substrate for AI work: skills, evals,
standards, templates, tickets, automations, runtime adapters, goals,
guardrails, and self-improvement loops. Farplane UI is the cockpit for that
harness. It gives the operator global surfaces for using and maintaining the
harness itself, then opens project-specific surfaces where each project behaves
like an autonomous company with its own goals, teams, files, work state,
evidence, and metrics.

Use the two repos together:

| Repo | Job |
| --- | --- |
| `Farplane/` | Cloneable harness core: framework contracts, skills, evals, templates, tickets, automations, graph/projection payloads, review loops, and install/runtime policy. |
| `Farplane-UI/` | Operator cockpit: launcher, global harness modules, project/company views, state bridge, visual office, settings, and browser-facing workflows. |

Codex is the default local runtime adapter for Farplane UI v0, and OpenClaw
remains an optional adapter path for persistent agents, sessions, routing, and
plugins. Farplane adds the cloneable harness, the office, the Core-owned CLI,
the review loop, and the operator surfaces that turn raw agent runtime into
something you can steer like a business.

## What Is Farplane UI?

If the runtime runs agents, Farplane is the harness around them. Farplane UI is
where the operator sees and steers that harness.

The UI is for founders and operators who want one readable place to run AI
work. Instead of juggling raw terminals, scattered configs, and hand-wired team
coordination, you clone Farplane, adapt the harness to your own standards, then
use Farplane UI to operate global harness surfaces and project-specific
autonomous company views.

The product is intentionally different from a static "spawn a giant company" model:

- clone your own harness, not a fixed hosted workspace
- start with one office, not a crowded org chart
- create teams around a concrete goal when they are needed
- keep runtime adapters such as Codex/OpenClaw as runtime sources of truth
- make orchestration operational, but also playful and expressive

The product doctrine behind this model lives in
[`docs/specs/FP02-harness-product-model.md`](./docs/specs/FP02-harness-product-model.md).

## How It Works

1. Define the business or goal you want to pursue.
2. Ask the CEO agent to form a focused team around that goal.
3. Review the proposal in Farplane and approve the work.
4. Manage the resulting team from the office, the board surfaces, and the CLI.

Inside a team:

- `Overview` shows compact roster cards with embedded face/avatar renders, role, live status, latest task context, and quick actions.
- `Memory` is the shared append-only team log for decisions, handoffs, and results, while Timeline and Kanban continue to show live execution state.
- direct agent-to-agent coordination is allowed through the CLI when session-local context matters, but it stays thin: the message runs through native OpenClaw transport and only leaves one visible breadcrumb in the shared timeline instead of reviving team chat as a second source of truth.

The main MVP loop is founder control, not artificial office scale.

## Why Farplane Is Different

- `OpenClaw-native`: Farplane sits on top of OpenClaw instead of rebuilding its runtime, session, routing, or plugin systems.
- `One office first`: the core unit is one AI office that can spawn teams for a mission, not a pre-populated multi-company dashboard.
- `Founder workflow`: CEO-led team formation, founder review, and approval are the primary product path.
- `Fun to operate`: the office is meant to feel alive, customizable, and rewarding to use, not just administratively correct.
- `Skills-aware`: Farplane includes tooling to inspect, understand, and use skills more effectively across agents.
- `Roster-led team ops`: each team surface makes it obvious who each agent is, what they are doing, and how to reach them.

## Farplane Is Right For You If

- you already use OpenClaw and want a founder-facing orchestration layer on top
- you want to define a business goal and let agents organize into focused teams around it
- you need one place to monitor sessions, proposals, board state, memory, and skills
- you want CLI control and office UI together instead of choosing one or the other
- you want the system to feel playful and customizable while still being operationally useful

## Features

- `CEO-led team formation`: create teams through a proposal and approval loop instead of hardcoding a company upfront
- `Office UI`: run Farplane from a visual office with focused operator surfaces instead of a pile of raw terminals
- `Farplane CLI`: Core-owned command routing for onboarding, teams, office state, doctor checks, and office decor
- `Session-scoped CLI identity`: agents can soft-login per shell session so status, coordination, and board writes resolve caller identity consistently without repeating `--agent-id`
- `Skills workbench`: inspect skills, demos, file-backed metadata, and per-agent skill configuration from one place
- `Memory and session visibility`: inspect agent memory, session context, and current work state from OpenClaw-backed data
- `Team presence and memory`: team overview surfaces show each member as a compact face/avatar card with role, live state, latest task, and quick actions, while the Memory tab keeps shared coordination/history in one append-only log instead of faux team chat
- `Plugin-first integrations`: keep integrations aligned with OpenClaw's plugin model, starting with the in-repo Notion plugin
- `Mesh and personalization path`: support agent personalization and mesh/image wrapper flows so the office can feel more alive over time
- `Office decor and style`: customize the office once the core founder-control loop is in place
- `Federated operations`: unify team and board context across Farplane and external providers without replacing the source systems

## Problems Farplane Solves

| Without Farplane | With Farplane |
| --- | --- |
| You have OpenClaw agents, configs, sidecars, and terminals, but no clear founder control surface. | You get one office and one workflow for forming teams, reviewing proposals, and overseeing active work. |
| You can run agents, but the jump from "one agent" to "a business with teams" is mostly manual. | The CEO can propose a team around a goal and Farplane gives you a reviewable path to approve and manage it. |
| You lose the story of what the office is doing because runtime details live in too many places. | Farplane brings memory, skills, sessions, boards, and team context into one operator-facing layer. |
| Your tooling feels purely operational and hard to enjoy using. | Farplane treats the office as both a control surface and a place you can personalize, decorate, and grow. |
| You want to use skills and integrations more intentionally, but discovery and operator visibility are weak. | Farplane adds skill-aware UI and CLI workflows so agents and operators can use the repo's skill system more effectively. |

## Quickstart

Prerequisites:

- Node.js 20+
- OpenClaw installed locally or on the target machine
- OpenClaw onboarding completed first on that machine

Important:

- Farplane does not replace OpenClaw setup.
- If OpenClaw has not created `~/.openclaw/openclaw.json` and the main CEO agent `main`, the Farplane office will not show the main agent correctly.

**OpenClaw onboarding (do this first):**

1. Install and run the OpenClaw onboarding wizard (recommended on macOS/Linux or Windows via WSL2):
   ```bash
   openclaw onboard
   ```
2. Use **QuickStart** for the fastest path (default workspace, gateway on port 18789, coding tool profile). The wizard creates `~/.openclaw/openclaw.json`, seeds the workspace, and configures model/auth.
3. OpenClaw’s default single-agent setup uses agent id **`main`**, which is what Farplane expects. If you added agents manually and don’t have `main`, either add it (`openclaw agents add main` and use the default workspace) or ensure `~/.openclaw/openclaw.json` has `agents.list` with an entry whose `id` is `"main"`.
4. Then run Farplane onboarding (see below).

Docs: [Onboarding Wizard (CLI)](https://docs.openclaw.ai/start/wizard), [CLI Onboarding Reference](https://docs.openclaw.ai/start/wizard-cli-reference).

Deployment docs:

- [VPS + Tailscale Serve runbook](./docs/how-to/vps-tailscale-farplane.md)

From the repo root:

```bash
npm install
farplane ui link "$PWD"
farplane onboarding
eval "$(farplane agent login --agent-id main)"
farplane whoami
farplane ui start
```

What `farplane onboarding` does:

- starts with a Farplane intro and an OpenClaw-first preflight check
- creates missing Farplane sidecar JSON under `~/.openclaw`
- creates or updates `~/.openclaw/openclaw.json` with the minimum Farplane wiring
- adds the in-repo Notion plugin load path and default `notion-shell` entry
- expects the global `farplane` CLI to be owned by Farplane Core and delegates module commands into this checkout
- asks for a basic office style preset
- shows a staged bootstrap flow so you can see each setup phase complete
- generates `ui/.env.local` with safe `VITE_*` values
- copies Convex URL from the repo-root `.env.local` when available
- persists the Convex site URL into Farplane runtime config so the CLI can reuse it without manual exports
- verifies whether the configured Convex runtime is actually reachable before it recommends or auto-launches the UI
- runs doctor checks and prints the next steps
- offers to launch the UI immediately only when the required runtime is ready, so onboarding does not hand off to a broken app

After that:

1. Open the UI.
2. Complete the in-app onboarding flow.
3. Ask the CEO agent to create your first team proposal.
4. Approve the proposal in `Human Review` inside the CEO Workbench.
5. Inspect the created team in the office and board surfaces.
6. Use `farplane office decor ...` after the core founder workflow is working.

If you are exposing Farplane from another VPS over a private tailnet, use the dedicated [VPS + Tailscale Serve runbook](./docs/how-to/vps-tailscale-farplane.md). It covers the required split between Farplane's `State Bridge URL` and the OpenClaw `Gateway URL`, plus the extra `/farplane/openclaw` proxy rule needed when Farplane lives under a path instead of `/`.

## Minimal Demo Flow

Use this when you want to show the product story clearly instead of loading a crowded office:

```bash
npm install
farplane ui link "$PWD"
farplane onboarding --launch-ui
scripts/reset-demo-office.sh --profile ladder
```

Then in the product:

1. Start with only the CEO and founder control loop visible.
2. Ask the CEO to form a `1-claw` team from a small brief.
3. Review and approve the proposal.
4. Show the created team board and activity.
5. Repeat with a `2-claw` or `3-claw` team to show that Farplane scales by spawning focused teams, not by shipping a giant default company.

## FAQ

### How is Farplane different from OpenClaw?

OpenClaw runs the agents. Farplane runs the office around them.

OpenClaw remains the runtime and source of truth for sessions, routing, plugins, and state. Farplane sits on top of that foundation and adds the founder workflow: CEO-led team formation, proposal review, operator visibility, office management, and CLI control.

### Is Farplane only for a research lab?

No. A research-lab workflow fits, but it is not the product boundary. Farplane is better described as an orchestration layer for running a business through one AI office, then spawning teams around concrete goals as the business grows.

### What does the CLI do?

The Farplane CLI handles onboarding, UI launch, team and proposal management, doctor checks, office commands, and decor workflows. It is part of the core product surface, not just a developer utility bolted onto the repo.

### What is the office personalization story?

Farplane includes office decor, style presets, and a broader personalization path for meshes and agent presence. The goal is not decoration for its own sake. The goal is to make the office feel alive and enjoyable without compromising the core founder-control workflow.

### How do skills fit into Farplane?

Skills are part of how Farplane makes agents easier to understand and operate. The repo includes a skill catalog, tests, demos, and UI/CLI surfaces that help operators see what skills exist, how they are meant to be used, and how they fit into multi-agent workflows.

## Repo Map

- `cli/`: the Farplane CLI, including onboarding, team management, office commands, and doctor checks
- `convex/`: backend contracts, HTTP endpoints, and event/status persistence
- `extensions/`: in-repo OpenClaw extensions, starting with the Notion plugin
- `skills/`: agent-facing skills and workflow/tooling packages used by the Farplane platform
- `ui/`: the Vite/React office UI and its local state bridge
- `templates/`: bootstrap files for OpenClaw config, sidecars, and workspace scaffolding

Canonical Farplane UI-owned sidecar state lives under `~/.farplane`, especially:

- `~/.farplane/company.json`
- `~/.farplane/office.json`
- `~/.farplane/office-objects.json`
- `~/.farplane/pending-approvals.json`
- `~/.farplane/assets/meshes/`

Codex is the default office runtime adapter for Farplane UI v0. When
`CODEX_APP_SERVER_URL=ws://127.0.0.1:<port>` is present on the UI dev server,
the local state bridge proxies Codex app-server JSON-RPC and maps Codex threads
into temporary office workers, sessions, and chat timelines. If the app-server
is not configured, Codex mode degrades to a single `codex-main` placeholder.
Codex office visibility is configured under the `codex` key in
`~/.farplane/office.json`:
`recentThreadWindowMinutes` controls which recent chats render as temporary
employees, `heartbeatThreadIds` keeps selected threads visible even when old,
`alwaysShowHeartbeatThreads` keeps heartbeat/running threads on the floor,
`showAutomationThreadsAsHeartbeat` treats Codex `Automation:` threads as
heartbeat employees, and unmatched/projectless chats are grouped under the
configurable `miscProjectName` table. `miscPathIncludes` can force scratch
folders such as `Documents/Codex` into that table even when Codex has
registered them as project paths.
OpenClaw runtime files, when the optional OpenClaw adapter is configured with
`VITE_FARPLANE_RUNTIME_ADAPTER=openclaw`, remain OpenClaw-owned under
`~/.openclaw`.

## Development

From the repo root:

```bash
npm install
farplane ui link "$PWD"
farplane onboarding --yes
farplane ui start
```

Validation:

```bash
npm run test:once
npm run typecheck
npm run build
```

Refresh the global CLI alias after pulling repo updates:

```bash
cd ../Farplane && farplane install
```

Useful commands:

- `npm run cli -- onboarding --json`
- `npm run cli -- onboarding --install-cli`
- `npm run cli -- onboarding --skip-install-cli`
- `npm run cli -- onboarding --launch-ui`
- `eval "$(farplane agent login --agent-id alpha-pm)"`
- `npm run cli -- whoami --json`
- `npm run cli -- agent list --json`
- `npm run cli -- agent search --query builder --json`
- `npm run cli -- agent send --from alpha-pm --to alpha-builder --message "Need blocker update" --task-id task-42 --json`
- `npm run cli -- ui`
- `npm run cli -- team run live --team-id team-proj-farplane-dev-team --cadence-minutes 1 --goal "Live demo loop" --json`
- `npm run cli -- team monitor --team-id team-proj-farplane-dev-team --json`
- `npm run cli -- team archive --team-id team-proj-example --deregister-openclaw`
- `npm run cli -- office decor docs`
- `npm run cli -- office decor list`
- `npm run cli -- office decor pack list`
- `npm run cli -- office decor floor list`

For autonomous-team MVP work, the main runtime artifacts are:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/projects/<projectId>/logs/`
- `~/.openclaw/projects/<projectId>/outputs/`
- `~/.openclaw/workspace-<agentId>/HEARTBEAT.md`

Realtime shared operational memory now lives in Convex-backed team/task surfaces, while OpenClaw workspace memory remains agent-owned/private and heavier artefacts stay filesystem-backed.
- agent-attributed CLI writes should come from a shell session that has been initialized with `farplane agent login`; `FARPLANE_AGENT_ID` is the canonical caller identity and team/project scope are derived from the company model, with conflicting manual overrides failing fast.
- `npm run cli -- office decor wall list`
- `npm run cli -- office decor background list`
- `npm run cli -- office decor pack apply clam-cabinet`
- `npm run cli -- office decor background set midnight_tide`
- `npm run cli:reinstall` for the module-local `farplane-ui` alias only
- `farplane ui`
- `npm run cli -- doctor team-data --json`
- `npm run cli -- office doctor --json`
- `npm run cli -- team list --json`

When you archive a team with `--deregister-openclaw`, Farplane now removes that team's OpenClaw `agents.list` entries and deletes each managed agent workspace under `~/.openclaw` so retired businesses do not leave stale runtime folders behind.
- `npm run cli -- team proposal list --json`
- `npm run cli -- team proposal show --proposal-id <proposalId> --json`
- `scripts/reset-demo-office.sh --profile minimal`
- `scripts/reset-demo-office.sh --profile ladder`

Notes:

- `npm run typecheck` is the workspace-wide TypeScript gate and includes the UI package.
- `npm run typecheck:root` checks only the repo-root/CLI/Convex TypeScript program.
- `npm run build` currently preserves the narrower root-owned build gate; use `npm run ui:build` for the Vite bundle.
- The UI reads Farplane-owned office sidecars from `~/.farplane`; Codex is the default runtime adapter, Codex app-server is reached only through the local state bridge, and OpenClaw runtime state remains adapter-owned when explicitly enabled.
- Optional Codex app-server smoke: run `codex app-server --listen ws://127.0.0.1:47891`, then launch the UI with `CODEX_APP_SERVER_URL=ws://127.0.0.1:47891 npm run ui -- --host 127.0.0.1`.
- The UI reads `VITE_*` values from `ui/.env.local`; backend/private env stays in the repo-root `.env.local`.
- Optional: set `VITE_MESHY_API_KEY` (get one at meshy.ai) to enable **Generate with AI** in Decoration → Import; generated GLB furniture is saved to Custom Library.
- The global `farplane` alias comes from Farplane Core. This repo exposes only the module-local `farplane-ui` package bin for direct checkout development.
- `templates/` is only for bootstrap and scaffolding. It is not the live source of truth after onboarding runs.

## More Docs

- [docs/prd.md](./docs/prd.md)
- [docs/progress.md](./docs/progress.md)
- [docs/public-docs/getting-started.md](./docs/public-docs/getting-started.md)
- [docs/public-docs/feature-teams-heartbeats.md](./docs/public-docs/feature-teams-heartbeats.md)
- [docs/public-docs/feature-personalization.md](./docs/public-docs/feature-personalization.md)
- [extensions/notion/README.md](./extensions/notion/README.md)
