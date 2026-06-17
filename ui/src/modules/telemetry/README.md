# Harness Usage Module

Runtime usage surfaces for completed agent hours, project/team contribution, and lifecycle diagnostics.

## Entrypoints

- `TelemetryPanel` for the global Harness Usage office launcher surface.
- `TelemetryDashboardContent` for global and team-scoped usage rendering.

## Structure

- `components/` contains telemetry-only presentation components and component-local CSS.
- `telemetry-dashboard-types.ts` and `telemetry-dashboard-format.ts` stay module-level shared helpers for all telemetry entrypoints.

## Test

- `npm run test:once -- runtimeTelemetry telemetry team-panel`
- Browser QA through the office launcher and Team Panel Usage tab.
