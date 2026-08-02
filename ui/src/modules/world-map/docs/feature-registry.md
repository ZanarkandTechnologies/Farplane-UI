# World Map Feature Registry

| Capability | Owner | Contract |
| --- | --- | --- |
| Project projection read | Vite state bridge | `GET /farplane/world?projectPath=<absolute path>` reads `.farplane/entities/world.json` plus the `index.json` fingerprint for stale detection; it never crawls Markdown or view YAML |
| Projection normalization | `lib/world-projection.ts` | Tolerant boundary around the additive Core `schema_version: 3` contract |
| Named entity views | Core projection + `WorldMapPanel` | Normalized `.farplane/views.yaml` membership appears as a selector; view membership intersects search, kind, and location filters |
| Metadata discovery | `WorldMapPanel` | Search by name, ID, alias, kind, and location; unlocated entities remain visible |
| Geographic rendering | `WorldMapCanvas` | Lazy Mapbox GL vector renderer promoted only after idle paint; loading and actionable retry states cover provider/WebGL startup while preserving paired-coordinate requirements and source-to-link mention flow |
| Map provider config | Vite state bridge + injected environment | `VITE_MAPBOX_ACCESS_TOKEN` enters the UI process through `farplane run -- …`; `GET /farplane/map-config` exposes only the bounded browser-safe renderer payload and never reads the token from `~/.farplane/config.toml` |
| Office entry | activity-landmark `uiBinding` | The starter and current Farplane Map landmark launches the registered `world` internal panel without a separate navigation path; Research Library remains a Docs Library entry |
| Evidence detail | `WorldMapPanel` | Entity source path and exact Markdown-derived association context |
| Entity timeline | Core projection + `WorldEntityDetail` | Dated `Timeline` bullets render on every linked entity with inline tags shown as neutral badges; domain interpretation belongs to specialized view consumers and no additional graph nodes are introduced |

States: no selected project, provider/map loading, map unavailable with retry,
missing projection, invalid/read failure, empty/filtered-none, unlocated-only,
stale, compilation issues, all entities, named view selected, node selected,
association selected, metadata-bearing timeline present, and entity without timeline data.

Deferred: Convex aggregation, cross-project identity resolution, editing,
geocoding, semantic relation inference, and SQLite.
