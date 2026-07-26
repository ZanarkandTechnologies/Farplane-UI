# Finance Module

Global company cash and cash-flow visibility for the operator. The module reads the
browser-safe `GET /farplane/finance` projection; all durable writes remain in
the CLI/automation-owned `~/.farplane/finance` sidecar.

`FinancePanel` and `OfficeStatsHud` consume the same TanStack Query key so the
latest cash balance cannot drift between surfaces. Balance snapshots are written with
`farplane-ui finance snapshot record`; project/team finance metrics remain independent.
