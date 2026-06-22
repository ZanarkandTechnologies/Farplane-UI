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

### Telemetry-First Codex Presence Proof

For tickets that render Codex workers from telemetry, prove the read-only
presence path separately from the app-server control path.

- Start `/office` without `CODEX_APP_SERVER_URL` and with seeded or real recent
  Codex telemetry rows.
- Confirm observed Codex workers render with read-only/observed state rather
  than disappearing or showing generic runtime-waiting copy.
- Confirm send-message, live-session, and office-role controls are disabled or
  prompt for connection while no selected Codex instance is connected.
- Configure or mock one Codex app-server instance, then confirm control actions
  enable only for workers owned by that instance.
- When testing multiple Codex instances, confirm source labels or inspector
  state distinguish the instances and no employee/session ids collide.

### Office Readiness And Character Renderer Proof

For canvas-heavy office proof, do not rely on a fixed timeout or on network
requests alone. Wait for the loader to clear, then inspect the dev probe exposed
by employee renderers.

Use the character-renderer proof script when changing employee graphics:

```bash
FARPLANE_OFFICE_URL=http://127.0.0.1:5199/office \
FARPLANE_CHARACTER_RENDERER=sprite-sheet-2d \
FARPLANE_CHARACTER_PET_ID=mini-kenji \
FARPLANE_CHARACTER_PROOF_DIR=tickets/<ticket>/artifacts/browser-qa \
node scripts/prove-office-character-renderers.mjs
```

The script:

- sets the same localStorage keys used by Settings → Office → Employee Graphics
- waits until `Loading office` is gone and a canvas is present
- reads `window.__farplaneOfficeCharacterRenderers`
- fails if employees still resolve to `three-human`, or if sprite rows report
  `fallback` / `error`
- writes a screenshot, crop, and JSON proof

Useful live probes:

```js
window.__farplaneOfficeCharacterRenderers
window.__farplaneOfficeClickProbe?.targets
window.__farplaneOfficeLiveEmployeePositions
```

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
