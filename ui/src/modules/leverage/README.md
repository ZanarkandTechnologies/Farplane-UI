# Leverage Module

The [Leverage Resource Workspace contract](../../../../docs/features/FEAT-0120-leverage-resource-workspace.md)
owns product and data semantics.

This module renders the single resource workspace. It reads
`GET /farplane/finance` for Capital and `GET /farplane/leverage` for
account-grouped Distribution, project Edge, and evidence gaps.

It never collects or writes source data, exposes provider IDs, or reads project
strategy or raw observations.
