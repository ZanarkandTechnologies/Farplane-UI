# Team Panel Farplane Config

## Goal

Prove the Team Panel renders the project-local `farplane/` config as a
source-honest game-style project HUD: Overview, Goals, Products, Kanban,
Cadence, Telemetry, and Config.

## Fast Entry

- Start the UI with `npm run ui`.
- Open `/office`.
- Open Team Workspace through the existing office panel entrypoint or QA bridge.
- Target the Farplane UI project/team.

## Setup

- Use the repository root as the project path.
- Required tracked files:
  - `farplane/manifest.json`
  - `farplane/README.md`
  - `farplane/harness.md`
  - `farplane/goals.md`
  - `farplane/products.md`
  - `farplane/automations.md`
  - `farplane/bindings.md`
  - `farplane/evals.md`
  - `farplane/hooks.json`
  - `farplane/pm.json`
- Runtime files under `.farplane/` are optional and may be absent. The UI
  should render missing-source states instead of fake data.

## Targets

- Local app: `http://127.0.0.1:5173/office`
- Useful bridge routes:
  - `/farplane/harness/template-tracking-scan`
  - `/farplane/project-pm`
  - `/farplane/hooks/config`
  - `/farplane/evals/runs`
  - `/farplane/projects/read-model`

## Stable Selectors

- Primary tab labels:
  - `Overview`
  - `Goals`
  - `Products`
  - `Kanban`
  - `Cadence`
  - `Telemetry`
  - `Config`
- Key labels:
  - KPI gauges
  - Party leader / PM
  - Harness traits or harness rules
  - Quest journal
  - Product world map or lane weights
  - Pulse, Daily, Weekly, PM, Hooks
  - Manifest, Harness, Bindings, Raw Files
- Source labels should include file paths such as `farplane/goals.md` and
  `farplane/manifest.json`.

## Playwright Path

1. Open `/office`.
2. Wait for the office QA bridge, if available.
3. Open Team Workspace for the Farplane UI project/team.
4. Capture screenshots for:
   - Overview
   - Goals
   - Products
   - Kanban
   - Cadence
   - Telemetry
   - Config
5. Confirm Overview shows KPI/CEO status before manifest/config details.
6. Confirm Telemetry uses the project/team-scoped runtime drilldown.
7. Repeat one pass at mobile width and verify the tab rail scrolls or wraps
   without document-level horizontal overflow.

## Agent-Browser Path

Use this path when the QA bridge or project/team selection is unstable:

1. Launch `/office`.
2. Use visible controls to open Team Workspace.
3. Select or confirm the Farplane UI project.
4. Record the visible top-level tabs, KPI labels, PM leader card, source path
   labels, and loaded/missing badges.
5. Capture console errors separately and classify local backend/runtime errors
   apart from Team Panel rendering failures.

## Observability

- Required evidence:
  - screenshots for all seven top-level tabs
  - one mobile screenshot of the tab rail/inline branches
  - QA report with `PASS | FAIL | NOT PROVABLE` for each tab and required
    missing-source state
- Useful logs:
  - browser console
  - network failures for `/farplane/*` routes
  - source-file parse errors shown in the UI

## Known Gaps

- A dedicated `project-config` read endpoint may not exist yet. TASK-0017
  should add the smallest allowlisted read model instead of broad recursive
  filesystem browsing.
- Some runtime sources under `.farplane/` may be absent in a clean checkout.
  That is expected and should render as a trustworthy empty state.
