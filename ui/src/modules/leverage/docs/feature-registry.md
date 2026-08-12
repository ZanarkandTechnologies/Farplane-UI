# Leverage Feature Registry

| Surface | Owner | Contract |
| --- | --- | --- |
| `GET /farplane/leverage` | `ui/server/leverage-projection.ts` + Vite bridge | Reads Finance and explicit raw snapshot cards from registered projects. |
| `LeveragePanel` | this module | The one resource workspace: Finance-owned Capital detail, account-identity-grouped Distribution with `Used by` projects, and one Edge row per project. |
| Office launchers | Office catalog/registry/store | Menu, command palette, cash HUD, and Finance Office room all open this panel through one normal panel state. |

`parseProjectUiSnapshot` remains numeric-only. Leverage has a separate raw-card
projection because Markdown Edge is intentionally not a Team Workspace metric card.
