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
- non-secret runtime settings in `~/.farplane/config.toml`
- optional `ui/.env.local` bootstrap compatibility for Vite-safe values
- doctor checks before sending you into the UI
- optional immediate UI launch at the end of the flow

## UI Environment

For day-to-day local projects, use Settings -> Runtime -> Project Config for
non-secret runtime URLs, hook/debug flags, and review settings. Farplane stores
those operator values in `~/.farplane/config.toml`. Credentials are supplied
only through the launched process environment; use `farplane run -- <command>`
in this checkout so Doppler injects the project-bound secrets.

Env files are optional bootstrap surfaces for non-secret values, not secret stores:

- repo-root `.env.local`: non-secret backend bootstrap values only
- `ui/.env.local`: UI-safe `VITE_*` values only

This split is intentional because the Vite app reads its env from `ui/`, not the repo root.

### Configure optional features with Doppler

The root [`.env.example`](../../.env.example) is the variable-name inventory;
leave its credential values blank. From the checkout whose Doppler project
should own the runtime:

```bash
doppler setup
doppler secrets set VARIABLE_NAME
farplane run -- corepack pnpm run ui
```

`doppler secrets set VARIABLE_NAME` prompts for the value instead of placing it
in shell history. Configure only the features you use:

| Feature | Doppler variables |
| --- | --- |
| Protected telemetry/state bridge | `FARPLANE_TELEMETRY_TOKEN`, `FARPLANE_STATE_BRIDGE_TOKEN` |
| OpenClaw gateway | `VITE_GATEWAY_TOKEN` |
| World map | `VITE_MAPBOX_ACCESS_TOKEN` or `MAPBOX_ACCESS_TOKEN` |
| AI furniture generation | `FARPLANE_MESHY_API_KEY` or `MESHY_API_KEY` |
| Notion | `NOTION_API_KEY` |
| Telegram | `TELEGRAM_BOT_TOKEN` |
| Slash finance | `SLASH_API_KEY` |
| Realtime employee calls | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` |
| Optional model/media tools | `OPENAI_API_KEY` or `CODEX_API_KEY`; `ELEVENLABS_API_KEY` for ElevenLabs audio |

Settings -> Runtime -> Project Config shows whether each listed credential or
supported alias is present in the launched process and prints the preferred
Doppler variable command when it is missing. It never accepts or saves the
value.

If you run `npx convex dev` and it writes a Convex URL into the repo-root `.env.local`, import it back into Farplane config with:

```bash
corepack pnpm run shell onboarding
```

That refreshes the non-secret Convex setting in `~/.farplane/config.toml`.

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
