---
ticket: TKT-024
artifact: browser-qa-report
created_at: 2026-06-14
route: /office/public
verdict: pass
---

# Browser QA Report

## Scope

Verify the public read-only office route for livestreaming:

- `/office/public` renders with public chrome and a WebGL canvas.
- The public menu and QA helper expose only read-oriented surfaces.
- Mutating launcher commands cannot execute through the QA helper.
- Public organization view hides team creation, team management, agent
  recruitment, CEO/PM assignment controls, and local project paths.
- Public Skill OS view hides file/editor/demo/control affordances.
- Public telemetry hides raw telemetry rows.

## Environment

- URL: `http://127.0.0.1:5173/office/public`
- Dev server: `npm run ui -- --host 127.0.0.1`
- Browser: Playwright Chromium, headless, SwiftShader WebGL flags
- Viewport: `1440x1000`

## Artifacts

- `01-public-route.png`
- `02-organization-public.png`
- `03-skill-os-public.png`
- `04-telemetry-public.png`
- `browser-proof.json`
- `skill-os-dom-proof.json`
- `diagnostic-public-route.png`
- `diagnostic-proof.json`

## Observations

- Route proof:
  - public badge: `true`
  - canvas present: `true`
  - visible safe panels: `Evals`, `Harness`, `Organization`, `Skill OS`,
    `Telemetry`
- Blocked QA helper commands:
  - `builder-mode`: `false`
  - `settings`: `false`
  - `team-workspace`: `false`
  - `ceo-workbench`: `false`
  - `human-review`: `false`
  - `office-shop`: `false`
- Organization proof:
  - `Create Team`: hidden
  - `Manage Teams`: hidden
  - `Recruit Agent`: hidden
  - `CEO Thread`: hidden
  - local path markers: hidden
  - read-only copy: visible
- Skill OS proof:
  - exact top-level buttons: `Skill OS`, `Evals`, `Harness`
  - exact mutating buttons: none
  - textareas: none
- Telemetry proof:
  - telemetry visible
  - `Raw Telemetry`: hidden

## Console

Only Vite/React dev messages and Chromium WebGL `ReadPixels` performance
warnings were observed. No page errors were reported.

## Verdict

Pass for TKT-024 browser QA. Public mode renders the office route and blocks or
hides the tested mutation and stream-sensitive surfaces while keeping the
office, organization, Skill OS summary, harness/evals, and telemetry summaries
available.
