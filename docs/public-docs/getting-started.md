# Getting Started

This is the longer companion to the root `README.md`. Start the local Office
first; run onboarding only when you need runtime-backed teams or integrations.

## Prerequisites

- Node.js 20+
- Corepack (included with supported Node.js releases)

Codex app-server, OpenClaw, and Convex are optional for the basic Office. Add
only the runtime services needed by the surfaces you want to exercise.

## First Run

From the repo root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run ui
```

Open the printed local URL at `/office` (commonly
`http://127.0.0.1:5173/office`).

For runtime-backed onboarding after the Office launches:

```bash
corepack pnpm run shell onboarding
```

Onboarding now handles:

- missing sidecar JSON bootstrap in `~/.openclaw`
- minimum OpenClaw config wiring for Farplane
- Notion plugin load-path and default entry setup
- office style preset capture
- staged progress output for each bootstrap phase
- migration of bootstrap env values into local private `~/.farplane/config.toml`
- optional `ui/.env.local` bootstrap compatibility for Vite-safe values
- doctor checks before sending you into the UI
- optional immediate UI launch at the end of the flow

## UI Environment

For day-to-day local projects, use Settings -> Runtime -> Project Config for
the settings listed in `.env.example`, including runtime URLs, hook/debug
flags, review settings, and API keys. Farplane stores local non-secret values
and API keys in local private `~/.farplane/config.toml`. The Vite bridge,
Farplane CLI, hooks, and runtime scripts read that local settings file before
explicit shell env overrides.

Env files are bootstrap/import surfaces, not runtime config fallbacks:

- repo-root `.env.local`: backend and private values such as Convex/OpenRouter/Notion tokens
- `ui/.env.local`: UI-safe `VITE_*` values only

This split is intentional because the Vite app reads its env from `ui/`, not the repo root.

If you run `npx convex dev` and it writes a Convex URL into the repo-root `.env.local`, import it back into Farplane config with:

```bash
corepack pnpm run shell onboarding
```

That refreshes `~/.farplane/config.toml` so the UI bridge, CLI, hooks, and scripts resolve the same value.

## CLI Notes

Repo-local:

```bash
corepack pnpm run shell onboarding --json
corepack pnpm run shell onboarding --launch-ui
```

Global:

```bash
npm link
farplane onboarding
farplane ui
```

Useful follow-up checks:

```bash
corepack pnpm run shell doctor team-data --json
corepack pnpm run shell office doctor --json
corepack pnpm run shell team monitor --team-id team-proj-farplane-dev-team --json
```

Useful runtime loop for autonomous-team MVP work:

```bash
corepack pnpm run shell team create --name "Farplane Dev Team" --description "Internal product team" --goal "Improve Farplane" --auto-roles pm,builder
corepack pnpm run shell team run live --team-id team-proj-farplane-dev-team --cadence-minutes 1 --goal "Live demo loop" --json
corepack pnpm run shell team monitor --team-id team-proj-farplane-dev-team --json
```

Canonical files to inspect during a live run:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/projects/<projectId>/outputs/`
- `~/.openclaw/workspace-<agentId>/HEARTBEAT.md`

## Next

- Complete the in-app onboarding flow after the UI boots.
- Read [feature-teams-heartbeats.md](./feature-teams-heartbeats.md) for the workspace + heartbeat model.
- Read [feature-personalization.md](./feature-personalization.md) for custom mesh and decor conventions.
- Read [docs/prd.md](../prd.md) for product direction.

- Read [extensions/notion/README.md](../../extensions/notion/README.md) if you need webhook/plugin details.
