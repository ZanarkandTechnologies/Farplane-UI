# World Map

Project-scoped Command Center module for inspecting generated CRM entities and
sentence-backed associations geographically.

```text
<project>/.farplane/crm/world.json
  -> GET /farplane/world?projectPath=<absolute path>
  -> useWorldProjection
  -> filters + GeoJSON points/lines + source detail
```

Markdown remains canonical. This module is a read-only consumer of the
disposable Core projection and does not write CRM data, geocode locations, or
persist graph state in SQLite or Convex.

Mapbox GL is the sole renderer. It uses Mapbox Standard in monochrome night mode
with a flat Mercator camera. The bundle is lazy and a dedicated loading surface
remains visible until the style and requested tiles reach an idle painted state.
A missing token, unavailable WebGL2 context, provider error, first-paint timeout,
or lost context produces an actionable error with retry instead of silently
switching map engines.

Configure a read-only, URL-restricted Mapbox public token under **Settings →
Project Config → UI-safe map provider**. Settings persists it as
`VITE_MAPBOX_ACCESS_TOKEN` in `~/.farplane/config.toml`; the browser receives it
only through the bounded map-config bridge when World opens.

A node is plotted only when its CRM entity has paired `latitude` and
`longitude`; the plain `location` field is searchable metadata and is not
silently geocoded.

Association lines retain the compiler's undirected knowledge semantics. Their
animated dash flow shows the Markdown mention path—from the containing entity
to the linked entity—rather than claiming a supplier/customer predicate. The
renderer retains that order and disables motion when the browser requests
reduced motion.

Open **World** from the office launcher or command palette. The currently
selected Command Center project is used by default and can be changed in the
panel header. The starter and current offices expose the same panel through the
**Farplane Map** activity landmark. The Research Library remains dedicated to
the Docs Library.

See [feature registry](docs/feature-registry.md) and [QA runbook](docs/qa-runbook.md).
