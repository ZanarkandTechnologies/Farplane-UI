# World Map Feature Registry

| Capability | Owner | Contract |
| --- | --- | --- |
| Project projection read | Vite state bridge | `GET /farplane/world?projectPath=<absolute path>` reads generated `world.json` plus the `entities.json` fingerprint for stale detection; it never crawls Markdown |
| Projection normalization | `lib/world-projection.ts` | Tolerant boundary around the Core `schema_version: 1` contract |
| Metadata discovery | `WorldMapPanel` | Search by name, ID, alias, kind, and location; unlocated entities remain visible |
| Geographic rendering | `WorldMapCanvas` | Leaflet + CARTO Dark Matter raster basemap with SVG points and animated dashed mention flow; an association requires two plotted endpoints and a node requires paired coordinates |
| Office entry | activity-landmark `uiBinding` | The starter and current Farplane Map landmark launches the registered `world` internal panel without a separate navigation path; Research Library remains a Docs Library entry |
| Evidence detail | `WorldMapPanel` | Entity source path and exact Markdown-derived association context |

States: no selected project, loading, missing projection, invalid/read failure,
empty/filtered-none, unlocated-only, stale, compilation issues, node selected,
and association selected.

Deferred: Convex aggregation, cross-project identity resolution, editing,
geocoding, semantic relation inference, and SQLite.
