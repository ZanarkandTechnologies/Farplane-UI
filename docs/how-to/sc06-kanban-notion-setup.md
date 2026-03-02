# SC06 Setup Guide: Kanban + Notion (Comments-First)

This runbook now uses a comments-only integration path:

- Internal ShellCorp remains canonical by default.
- Notion is used for comment ingress/egress.
- `notion-shell.tasks.*` methods are deprecated for active onboarding (keep them only for compatibility while migrating workflows to skills).

## Step 1: Load the Notion Plugin in OpenClaw

1. Open your OpenClaw config (`~/.openclaw/openclaw.json`).
2. Add plugin load path pointing to this repo plugin directory.
3. Enable `notion-shell` entry.
4. Set plugin default account id.
5. Set Notion API key under channel account config.
6. Restart OpenClaw gateway.

Minimal config shape:

```json
{
  "plugins": {
    "enabled": true,
    "load": {
      "paths": ["/home/kenjipcx/Zanarkand/ShellCorp/extensions/notion"]
    },
    "entries": {
      "notion-shell": {
        "enabled": true,
        "config": {
          "defaultAccountId": "default"
        }
      }
    }
  },
  "channels": {
    "notion": {
      "accounts": {
        "default": {
          "apiKey": "secret_xxx",
          "requireWakeWord": true,
          "wakeWords": ["@shell"]
        }
      }
    }
  }
}
```

## Step 2: Verify Plugin Load

Run:

```bash
openclaw plugins list
openclaw plugins info notion-shell
```

You should see `notion-shell` loaded and enabled.

## Step 3: Configure In-App (Control Deck)

In the app:

1. Open `Settings` -> `Control Deck (OpenClaw Config)`.
2. Fill:
   - `notion-shell defaultAccountId`
   - `channels.notion.accounts.default.apiKey`
3. Click `Patch Draft From Controls`.
4. Click `Preview Changes`.
5. Enable `confirm config write`.
6. Click `Apply Config`.
7. Click `Load Live Config` to confirm persistence.

## Step 4: Configure SC06 Per Project in Team Panel

1. Open `Team` panel.
2. Go to `Kanban` tab.
3. Set `Canonical` provider:
   - Start with `internal` (recommended default).
4. Use `Provider` filter (`all/internal/notion/vibe/linear`) to inspect task source.
5. Use `Manual Resync` for provider synchronization.

Task cards should show:

- provider badge
- sync state badge (`healthy | pending | conflict | error`)
- optional deep link to provider task

## Step 5: Bootstrap Notion Profile (for deterministic tool metadata)

1. Open `Team` panel -> `Projects` tab.
2. In `Notion Provider Profile`:
   - Enter Notion database id.
   - Optionally enter tool naming prefix.
3. Click `Save Profile`.

This stores a project-scoped provider profile used for stable context-tool metadata generation.

## Step 6: Phase A Temporary Probe (FastAPI)

Use this only to capture real webhook payloads and complete Notion subscription verification.

1. Start probe server:

```bash
cd /home/kenjipcx/Zanarkand/ShellCorp/tools/notion-webhook-probe
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8321
```

1. Expose via Tailscale Funnel:

```bash
tailscale funnel 8321
```

1. In Notion webhook settings, set:

```text
https://<machine>.<tailnet>.ts.net/hooks/notion
```

1. Verify subscription:
   - Notion sends `{"verification_token":"secret_..."}` once.
   - Probe logs token in stdout.
   - Paste token into Notion verification UI.

2. Trigger payload capture:
   - Add test comments on a page the integration can access.
   - Include one comment with wake-word and one without.
   - Probe writes payload JSON files under `tools/notion-webhook-probe/payloads/`.

## Step 7: Phase B Hot-Swap to OpenClaw Hooks (Production)

1. Add `hooks` config to `~/.openclaw/openclaw.json` (see `docs/how-to/notion-comment-hook-contract.md`).
2. Add transform module at `~/.openclaw/hooks/transforms/notion.ts`.
3. Point Funnel at OpenClaw gateway port (`18789`) instead of probe.
4. Keep webhook path as `/hooks/notion`.
5. Re-test with a wake-word comment.

## Step 8: Validate End-to-End Quickly

1. Create/update a task in ShellCorp Kanban.
2. Confirm it remains internal-canonical by default.
3. Switch canonical to `notion` only when you want external ownership.
4. Run `Manual Resync`.
5. Verify sync state badges update and deep links appear for Notion-backed tasks.

## Notion Comments Provider Status

Yes, you can install and run it now in local/in-repo mode with the two-phase workflow.

- Outbound Notion comment sending is available through the registered Notion channel plugin.
- Inbound webhook mapping is now based on OpenClaw hooks (`/hooks/<name>`) and transform modules.
- Use the temporary FastAPI probe only for verification/payload discovery; remove it once OpenClaw mapping is active.

## Deprecated from Active Onboarding

These methods still exist for compatibility, but are out-of-path for this comments-first slice:

- `notion-shell.tasks.list`
- `notion-shell.tasks.create`
- `notion-shell.tasks.update`
- `notion-shell.tasks.sync`

## References

- OpenClaw Plugins docs: <https://docs.openclaw.ai/tools/plugin#plugins>
- OpenClaw Webhooks docs: <https://docs.openclaw.ai/automation/webhook>
