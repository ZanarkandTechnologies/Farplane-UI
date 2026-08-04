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
corepack pnpm run ui
```

Open the printed local URL at `/office`. A basic Office launch does not require
Codex app-server, OpenClaw, or Convex.

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

### Finance Snapshot Proof

Use an isolated state root when proving company cash so personal finance data is
never touched:

```bash
FARPLANE_STATE_DIR=/tmp/farplane-finance-proof \
  corepack pnpm --filter @farplane/cli cli finance snapshot record \
  --balance -400 --as-of 2026-07-22 --source bank-statement --json
```

Launch the UI with the same `FARPLANE_STATE_DIR`, open `/office`, and inspect
`office-finance-hud-trigger` and `finance-latest-balance`. The HUD and panel must
both show negative `$400` in the destructive tone, while the panel retains
separate weekly/monthly flow cards. Capture a screenshot plus browser console
and page errors.

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

### Legacy Activity Destination Proof

Use this section only for the pre-office-kit destination-room layout. It must
not be applied to `TASK-0053` or later equipped-kit composition; use the
Equipped Office Kit Lifecycle Proof below instead.

When changing landmark placement or employee activity scenes, capture these
separately at the normal office camera:

- overview: the generated office has one rectangular work core; canonical
  destinations distribute uniformly across north, east, and west rails; the
  camera-facing south edge stays open; and central team-table routes remain open
- room presentation: every room uses the same complete 5 x 5 colored floor
  zone, keeps its landmark prop at authored scale, has no bay walls or corner
  fillers, keeps a walk-in opening, and presents station contents toward the
  fixed isometric camera
- walk-in room: the employee route ends on the colored interior floor and does
  not treat the room shell or landmark prop cluster as a navigation obstacle
- geometry: core width/depth are multiples of five, every room zone covers 25
  tiles, the global office outline remains one smooth rectangle, no room
  occupies the south rail, and the automatic solver reports zero edge pruning
- compactness: compare source and final width, depth, and tile count; the source
  mask must not impose a minimum on the final core, required persisted object
  transforms must remain unchanged, and ordinary decor must remain inside the
  central core rather than creating isolated annexes
- approach: the employee keeps its normal travel animation and has no scene prop
- engaged: the destination's base clip and transient prop are both visible
- cleanup: replacing/ending the target removes the prop and restores normal
  animation

Use Team Workspace → Characters → Skill transformation to emit a synthetic
presentation-only skill event without fabricating runtime telemetry. Select the
Library destination to prove Mini Kenji's `review` row plus open-book fallback.
Record the browser console and page errors alongside the screenshots.

### Hosted Operating Rooms Proof

For `TASK-0081` and later hosted-room composition, prove the office as one
operating system rather than eleven unrelated landmarks:

1. Capture the default office overview and confirm exactly eleven distinct
   rooms, one fixed host per room, a readable center Command Commons, and no
   duplicated specialist desks.
2. Click one office-scoped host twice and confirm the same logical chat is
   reused. Select project A then project B and confirm a Research/Production/QA
   host opens isolated project conversations. With no selected project, confirm
   the host asks for selection instead of opening the wrong scope.
3. Emit or seed a curated room skill event and confirm one transient worktable
   appears in the owning room, remains bounded to three visible tables plus
   overflow, exposes no absolute path, and disappears after expiry without
   changing persisted office objects.
4. Open every room's registered panel. Confirm QA is labeled QA Lab, no Planning
   Room remains, the legacy Resource Archive has migrated to Finance Office,
   and Self-Improvement Lab shows real Goal
   Packet runs or an honest empty state.
5. Open Command Commons and confirm Company World defaults to All projects,
   project-qualified entities do not collide, and a failed project read is a
   warning rather than a blank aggregate.
6. Seed projects at 6d23h59m, exactly 7d, and over 7d inactivity. Confirm the
   first two render; the stale idle project has no cluster, employee, desk,
   pulse, or area but remains in company-backed panels. Confirm running, active
   Goal, recent heartbeat, and missing-timestamp exceptions remain visible.
7. Record default-camera desktop and narrow-viewport screenshots, browser
   console, page errors, and the room/host/project counts exposed by the QA
   bridge.

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

### Equipped Office Kit Lifecycle Proof

For `TASK-0053` and later office-kit work, prove one ordered lifecycle instead
of checking persistence and visuals separately:

1. Seed a deterministic kit preview and snapshot the unchanged sidecar.
2. Equip it; capture the ownership receipt, office layout, semantic
   `officeObjects`, and default-camera screenshot.
3. Reload twice and compare stable layout/object signatures.
4. Enter Builder with `Alt+Shift+B`, edit one tile and one semantic prefab,
   Apply, reload, and confirm the office is now authoritative/manual.
5. In Builder Layout -> Office Kits, preview another kit without mutation,
   cancel once, then exercise the customized-office conflict and reset/replace
   while confirming user-created objects are preserved.
6. In fixed isometric, prove wheel/pinch zoom and pan while rotation remains
   locked; record the camera probe before and after.
7. Enter Story for a seeded employee and record target-ready plus camera-settled
   timestamps; repeat for a perimeter employee.
8. Seed one `created` and one `forked` lineage edge; capture the cyan link or
   projection and confirm deterministic cleanup/dedupe.
9. Fill reserved project capacity, then add one persistent project past
   capacity; confirm the live office does not reflow and a larger-kit preview is
   offered.
10. Seed 0, 1, and 20 ephemeral workers and confirm identical persisted layout,
   object, and collision signatures. Probe leaf furniture/wall intersections,
   circulation clearance, and employee-to-desk scale.
11. Capture light and dark screenshots from the same equipped kit with no
   transform or layout changes.

Required probes should be exposed through `window.__FARPLANE_QA__` rather than
inferred from pixels: kit/source/customization state, semantic object count,
layout signature, occupancy intersections, active camera and controls, Story
timings, presence classification, and active lineage-effect keys.

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
