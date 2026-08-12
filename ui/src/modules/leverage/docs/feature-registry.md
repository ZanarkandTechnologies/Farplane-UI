# Leverage Feature Registry

| Surface | Owner | Contract |
| --- | --- | --- |
| `GET /farplane/leverage` | `ui/server/leverage-projection.ts` + Vite bridge | Reads Finance and explicit raw snapshot cards from registered projects. |
| `LeveragePanel` | this module | Read-only three-section view: global Capital, account-identity-grouped Distribution with `Used by` projects, and one Edge row per project. |
| Office launcher | Office catalog/registry/store | Opens the global panel through normal panel state. |

`parseProjectUiSnapshot` remains numeric-only. Leverage has a separate raw-card
projection because Markdown Edge is intentionally not a Team Workspace metric card.
