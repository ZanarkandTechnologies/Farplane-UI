# Finance Module

The [Global Finance Observations contract](../../../../docs/features/FEAT-0116-global-finance-observations.md)
owns Capital; the [Leverage workspace contract](../../../../docs/features/FEAT-0120-leverage-resource-workspace.md)
owns how it is presented.

This module reads the browser-safe `GET /farplane/finance` projection and renders
Capital inside Leverage. Durable writes remain in the CLI/automation-owned
`~/.farplane/finance` sidecar; there is no independent Finance panel.
