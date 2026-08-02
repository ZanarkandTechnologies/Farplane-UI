# World Map

Project-scoped Command Center module for inspecting canonical entities and
sentence-backed associations geographically through generated views.

```text
<project>/.farplane/entities/world.json
  -> GET /farplane/world?projectPath=<absolute path>
  -> useWorldProjection
  -> filters + GeoJSON points/lines + source detail
```

Entity Markdown plus `.farplane/views.yaml` remain canonical. This module is a
read-only consumer of the disposable Core projection and does not write entity
data, view membership, geocode locations, or persist graph state in SQLite or
Convex. The configured view selector intersects membership with search, kind,
and location filters; **All entities** restores the complete projection.

Mapbox GL is the sole renderer. It uses Mapbox Standard in monochrome night mode
with a flat Mercator camera. The bundle is lazy and a dedicated loading surface
remains visible until the style and requested tiles reach an idle painted state.
A missing token, unavailable WebGL2 context, provider error, first-paint timeout,
or lost context produces an actionable error with retry instead of silently
switching map engines.

Inject a read-only, URL-restricted `VITE_MAPBOX_ACCESS_TOKEN` when launching the
UI with `farplane run -- corepack pnpm run ui`. The browser receives it only
through the bounded map-config bridge when World opens; Farplane does not read
or persist it in `~/.farplane/config.toml`.

A node is plotted only when its canonical entity has paired `latitude` and
`longitude`; the plain `location` field is searchable metadata and is not
silently geocoded.

Association lines retain the compiler's undirected knowledge semantics. Their
animated dash flow shows the Markdown mention path—from the containing entity
to the linked entity—rather than claiming a supplier/customer predicate. The
renderer retains that order and disables motion when the browser requests
reduced motion.

Company and person Markdown may also carry dated bullets under `## Timeline`.
The additive projection rows preserve optional metadata without creating extra
graph nodes. Selecting an entity shows neutral metadata badges and all timeline
rows that either originate from or link to that entity. World does not assign
domain semantics to view-specific signals, metrics, resources, or weights;
specialized consumers read `.farplane/views/<view-id>.json` instead.

Open **World** from the office launcher or command palette. The currently
selected Command Center project is used by default and can be changed in the
panel header. The starter and current offices expose the same panel through the
**Farplane Map** activity landmark. The Research Library remains dedicated to
the Docs Library.

See [feature registry](docs/feature-registry.md) and [QA runbook](docs/qa-runbook.md).
