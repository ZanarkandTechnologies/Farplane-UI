# Office UI QA

## Goal

Verify the Farplane office, runtime mode settings, project/team tables,
employee/thread presence, and panel entrypoints without relying on brittle
canvas-only clicking.

## Fast Entry

- Route: `/office`
- Command palette: `Cmd/Ctrl+K`
- Settings shortcut: `Alt+Shift+P`
- Team workspace shortcut: `Alt+Shift+T`
- Agent session shortcut: `Alt+Shift+A`
- Builder mode shortcut: `Alt+Shift+B`

## Setup

Start the app:

```bash
npm run ui
```

For Codex-backed project/thread data, start the UI with `CODEX_APP_SERVER_URL`
pointing at the Codex app server.

For OpenClaw-backed runtime data, select the OpenClaw adapter in Settings and
ensure the gateway URL/token are reachable from the browser.

## Targets

- Local UI: Vite prints the active URL; commonly `http://127.0.0.1:5173`.
- Office route: `/office`.
- Farplane state bridge routes are served from the UI origin.

## Stable Entrypoints

- Top-left office menu.
- Command palette.
- Global keyboard shortcuts.
- Dev-only QA bridge:

```ts
window.__FARPLANE_QA__.listPanels();
window.__FARPLANE_QA__.openPanel("agent-session");
window.__FARPLANE_QA__.runCommand("builder-mode");
```

## Playwright Path

Target stable regression coverage for:

- office route loads without a blank canvas
- Settings opens and switches between General, Office, and Runtime tabs
- runtime mode selector exposes Codex and OpenClaw
- Team Workspace opens from keyboard/command entry
- Agent Session opens from keyboard/command entry
- Builder Mode toggles without losing panel access

## Agent-Browser Path

Use `agent-browser` for quick proof:

```bash
agent-browser open http://127.0.0.1:5173/office
agent-browser snapshot -i -c --json
agent-browser screenshot /tmp/farplane-office.png
agent-browser console
agent-browser errors
```

Prefer shortcuts and the QA bridge for panel coverage. Use in-world clicking
only when the ticket specifically changes scene hit targets, object selection,
or team/employee interaction behavior.

## Clickability Probes

Development builds expose office clickability diagnostics:

- `OfficeClickProbe` runs in the scene in dev mode.
- `scripts/measure-office-clickability.mjs` measures click target reliability.
- Employee live positions are recorded through the dev-only employee position
  probe.

Use these when table or employee clicks feel unreliable.

## Reference Runbooks

- `docs/how-to/qa-agent-guide.md`
- `docs/how-to/ai-office-ui-qa-runbook.md`

## Known Gaps

- Full Playwright coverage is not yet the default final proof for all office
  flows.
- Some workflows still need better stable selectors or DOM mirrors because the
  office is canvas-heavy.
