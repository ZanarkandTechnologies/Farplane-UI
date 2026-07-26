# QA

Durable browser-QA guidance for Farplane UI lives here.

This folder is for reusable runbooks that help agents and humans reach
important app states quickly, deterministically, and with good evidence. It is
not the place for one-off screenshots or per-run logs.

## Default Flow

1. Use `agent-browser` to prove or debug a workflow when the path is new,
   brittle, canvas-heavy, or not yet instrumented.
2. Add or update Playwright coverage once the happy path is stable enough to
   regress automatically.
3. Keep `agent-browser` as the debugging lane when Playwright breaks.

## Evidence Policy

Ticket-scoped evidence should live with the ticket when possible. Until every
ticket has an artifact folder convention, use:

```text
docs/research/qa-testing/<TICKET_ID>/YYYY-MM-DD_HHMMSS_<topic>/
  report.md
  snapshot.json
  screens/*.png
  logs/console.txt
  logs/errors.txt
```

Every UI QA report should reconcile:

- acceptance criteria: `PASS | FAIL | NOT PROVABLE`
- declared screens/states: `PASS | FAIL | NOT PROVABLE`
- required evidence items: `CAPTURED | MISSING`

## Runtime Paths

- App-only local run: `corepack pnpm run ui`
- QA/evidence run: start `corepack pnpm run ui`, then use the relevant cookbook page.
- Expected local UI target: Vite prints the active host/port; common local
  target is `http://127.0.0.1:5173`.
- Codex runtime needs `CODEX_APP_SERVER_URL` when using app-server-backed
  project/thread data.
- OpenClaw runtime needs the gateway reachable from the browser when the
  OpenClaw adapter is selected.

## Cookbook

Use `qa/cookbook/` for repeatable app areas:

- `qa/cookbook/office.md`: office UI, settings, panels, in-world clicks, QA
  bridge, and clickability probes.

Older runbooks under `docs/how-to/` remain reference material, but new durable
QA entrypoints should be mirrored here.
