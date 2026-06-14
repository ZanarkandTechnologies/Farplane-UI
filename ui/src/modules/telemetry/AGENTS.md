# Telemetry Module Contract

## Boundaries

- Own global runtime telemetry dashboards and shared telemetry display components.
- Keep lifecycle math in Convex/shared reducer code; UI only renders returned summaries.
- Team-scoped entrypoints may import `TelemetryDashboardContent`, but Team Workspace owns its tab shell.

## UI

- Use Farplane shadcn-style primitives and theme tokens.
- Keep telemetry-owned presentation pieces under `components/`; global primitives such as shadcn wrappers stay in `ui/src/components/ui`.
- Keep dense operational layouts: compact cards, tables, tabs, badges, and explicit empty/diagnostic states.
- Do not import old Farplane-Console/Aikage dashboard components.
