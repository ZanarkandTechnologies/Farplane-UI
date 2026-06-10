# Farplane On A VPS With Tailscale Serve

This runbook covers the deployment shape where:

- OpenClaw gateway stays on the VPS
- Farplane UI stays on the VPS
- both services bind to loopback
- Tailscale Serve exposes them to the private tailnet
- Farplane is mounted under `/farplane` instead of `/`

## Runtime Model

Farplane uses two separate browser-facing surfaces:

- `Gateway URL`: the OpenClaw gateway HTTP/WebSocket endpoint
- `State Bridge URL`: the Farplane Vite app origin/path that serves `/openclaw/...` bridge routes for the UI

When Farplane is mounted under `/farplane`, the browser-facing values are different:

- `Gateway URL` should point at the OpenClaw gateway endpoint
- `State Bridge URL` should point at the Farplane path

Example:

- `Gateway URL` = `https://lester.bicorn-ghoul.ts.net`
- `State Bridge URL` = `https://lester.bicorn-ghoul.ts.net/farplane`

Do not enter `http://127.0.0.1:18789` in the UI unless the browser is running on the VPS itself. From another machine, `127.0.0.1` means that other machine, not the VPS.

## Prerequisites

- OpenClaw onboarding already completed on the VPS
- `openclaw gateway` works locally on the VPS
- Farplane repo checked out on the VPS
- Tailscale installed and logged into the same tailnet

Recommended local bind shape on the VPS:

- OpenClaw gateway: `127.0.0.1:18789`
- Farplane UI/state bridge: `127.0.0.1:5173`

## Start The Services

From the Farplane repo on the VPS:

```bash
npm install
npm run shell -- onboarding
npm run shell -- ui
```

From the OpenClaw environment on the VPS:

```bash
openclaw gateway
```

Keep both processes running before testing the Tailscale ingress.

## Tailscale Serve Layout

If `/` is reserved for the OpenClaw gateway and Farplane must live under `/farplane`, use a serve config with both of these rules:

- `/farplane` -> Farplane Vite app
- `/farplane/openclaw` -> Farplane Vite bridge `/openclaw`

That second rule is required because Farplane's bridge only handles upstream paths beginning with `/openclaw/...`.

Example serve config:

```json
{
  "TCP": {
    "443": {
      "HTTPS": true
    }
  },
  "Web": {
    "lester.bicorn-ghoul.ts.net:443": {
      "Handlers": {
        "/farplane/openclaw": {
          "Proxy": "http://127.0.0.1:5173/openclaw"
        },
        "/farplane": {
          "Proxy": "http://127.0.0.1:5173/farplane"
        },
        "/n8n": {
          "Proxy": "http://127.0.0.1:5678"
        },
        "/": {
          "Proxy": "http://127.0.0.1:18789"
        }
      }
    }
  }
}
```

Important:

- `/farplane/openclaw` must be more specific than `/farplane`
- the `/farplane/openclaw` proxy target must strip the `/farplane` prefix and forward to `http://127.0.0.1:5173/openclaw`
- if `/farplane/openclaw/...` goes upstream as `/farplane/openclaw/...`, the Farplane bridge will miss and return the SPA HTML instead of JSON

## Farplane UI Settings

From another computer on the tailnet:

1. Open `https://lester.bicorn-ghoul.ts.net/farplane`
2. Open Farplane Settings
3. Enter:

```text
Gateway URL: https://lester.bicorn-ghoul.ts.net
Gateway Token: <your-openclaw-token>
State Bridge URL: https://lester.bicorn-ghoul.ts.net/farplane
```

Why:

- `Gateway URL` should target the OpenClaw gateway at `/`
- `State Bridge URL` should target the Farplane app path because the UI reads `stateBase + /openclaw/...`

## Verification

Run these checks from another machine on the same tailnet.

Farplane bridge check:

```bash
curl -i https://lester.bicorn-ghoul.ts.net/farplane/openclaw/agents
```

Expected:

- `content-type: application/json`
- JSON payload describing agents

Not expected:

- `content-type: text/html`
- the Farplane `index.html` page

Gateway check:

```bash
curl -i https://lester.bicorn-ghoul.ts.net/
```

Expected:

- response from the OpenClaw gateway or Control UI

## Common Failure Modes

### `/farplane/openclaw/agents` returns HTML

Cause:

- Tailscale Serve is forwarding `/farplane/openclaw/...` to Vite without stripping `/farplane`

Fix:

- add a dedicated `/farplane/openclaw` rule that proxies to `http://127.0.0.1:5173/openclaw`

### Gateway shows disconnected

Cause:

- `Gateway URL` points at `127.0.0.1`
- wrong token
- OpenClaw gateway is not reachable behind `/`

Fix:

- use the tailnet URL, not loopback
- confirm the token matches the OpenClaw gateway token
- confirm `openclaw gateway` is running on the VPS

### Bridge reads fail but the page loads

Cause:

- `State Bridge URL` is wrong
- `/farplane/openclaw` path is not proxied correctly

Fix:

- set `State Bridge URL` to the public Farplane path, for example `https://lester.bicorn-ghoul.ts.net/farplane`
- verify `curl -i https://<magicdns>/farplane/openclaw/agents` returns JSON

## Notes

- Farplane under `/farplane` requires both the frontend path handling and the bridge path handling to agree.
- OpenClaw `gateway.controlUi.basePath` applies to OpenClaw's built-in Control UI, not to Farplane's Vite state bridge.
- If you do not need `/farplane`, the simplest setup is to serve Farplane at `/` and move the OpenClaw gateway to a separate hostname or port.
