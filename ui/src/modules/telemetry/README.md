# Telemetry Module

Runtime telemetry surfaces for completed agent hours, project/team contribution, and lifecycle diagnostics.

## Entrypoints

- `TelemetryPanel` for the global office launcher surface.
- `TelemetryDashboardContent` for global and team-scoped rendering.

## Test

- `npm run test:once -- runtimeTelemetry telemetry team-panel`
- Browser QA through the office launcher and Team Panel Telemetry tab.
