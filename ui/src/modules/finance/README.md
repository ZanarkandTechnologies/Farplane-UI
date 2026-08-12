# Finance Module

Global company cash and cash-flow evidence. The module reads the browser-safe
`GET /farplane/finance` projection; all durable writes remain in the
CLI/automation-owned `~/.farplane/finance` sidecar. It has no independent
launcher or panel: `FinanceCapitalDetails` is rendered inside Leverage's Capital
section.

`FinanceCapitalDetails` and `OfficeStatsHud` consume the same TanStack Query key so the
latest cash balance cannot drift between surfaces. The HUD opens Leverage. Balance snapshots
are written with `farplane-ui finance snapshot record`; project/team finance metrics remain independent.
