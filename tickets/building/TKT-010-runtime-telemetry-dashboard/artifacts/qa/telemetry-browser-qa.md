# TKT-010 Browser QA

## Run

- Date: 2026-06-13
- App: `npm run ui -- --host 127.0.0.1`
- URL: `http://127.0.0.1:5173/office`
- Driver: Playwright Chromium through the dev QA registry

## Steps

1. Loaded `/office`.
2. Waited for `window.__FARPLANE_QA__`.
3. Verified `telemetry` appears in `listPanels()`.
4. Opened global Telemetry with `openPanel("telemetry")`.
5. Captured `global-telemetry.png`.
6. Opened global Team Workspace with `openPanel("team-workspace")`.
7. Switched to the `Telemetry` tab.
8. Captured `team-telemetry.png`.

## Results

- Global Telemetry panel opens through the office panel registry.
- Team Panel includes the `Telemetry` tab and renders the shared telemetry content.
- With Convex disabled in this local UI session, both surfaces show the compact `Telemetry unavailable` state.
- Console errors were limited to headless WebGL context creation from the 3D office scene; panel opening and screenshots still completed.

## Evidence

- `global-telemetry.png`
- `team-telemetry.png`
