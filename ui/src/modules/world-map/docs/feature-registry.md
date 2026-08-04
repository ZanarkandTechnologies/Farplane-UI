# World Map Feature Registry

| Capability | Owner | Contract |
| --- | --- | --- |
| Project projection read | Vite state bridge | `GET /farplane/world?projectPath=<absolute path>` reads `.farplane/entities/world.json` plus the `index.json` fingerprint for stale detection; it never crawls Markdown or view YAML |
| Company projection | `useCompanyWorldProjection` + `lib/company-world-projection.ts` | Stable sorted/deduped configured project refs reuse the project query key, isolate read failures, qualify identities by configured project id, and cap the panel at 24 projects / 400 nodes / 800 edges |
| Projection normalization | `lib/world-projection.ts` | Tolerant boundary around the additive Core `schema_version: 3` contract |
| Named entity views | Core projection + `WorldMapPanel` | Normalized `.farplane/views.yaml` membership appears as a selector; view membership intersects search, kind, and location filters |
| Metadata discovery | `WorldMapPanel` | Search by name, ID, alias, kind, and location; unlocated entities remain visible |
| Geographic rendering | `WorldMapCanvas` | Lazy Mapbox GL vector renderer promoted only after idle paint; loading and actionable retry states cover provider/WebGL startup while preserving paired-coordinate requirements and source-to-link mention flow |
| Map provider config | Vite state bridge + injected environment | `VITE_MAPBOX_ACCESS_TOKEN` enters the UI process through `farplane run -- …`; `GET /farplane/map-config` exposes only the bounded browser-safe renderer payload and never reads the token from `~/.farplane/config.toml` |
| Office entry | Command Commons `uiBinding` | The central table launches the registered `world` internal panel in default All-projects mode; its bounded static cue avoids a second scene data owner |
| Evidence detail | `WorldMapPanel` | Entity source path and exact Markdown-derived association context |
| Entity timeline | Core projection + `WorldEntityDetail` | Dated `Timeline` bullets render on every linked entity with inline tags shown as neutral badges; domain interpretation belongs to specialized view consumers and no additional graph nodes are introduced |

States: no configured project, all projects, partial project warning, project cap,
provider/map loading, map unavailable with retry,
missing projection, invalid/read failure, empty/filtered-none, unlocated-only,
stale, compilation issues, all entities, named view selected, node selected,
association selected, metadata-bearing timeline present, and entity without timeline data.

Deferred: scene preview snapshot ownership, Convex aggregation, cross-project identity resolution, editing,
geocoding, semantic relation inference, and SQLite.
