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

Leaflet owns projection, pan, and zoom over CARTO Dark Matter raster tiles. A node
is plotted only when its CRM entity has paired `latitude` and `longitude`; the
plain `location` field is searchable metadata and is not silently geocoded.

Association lines retain the compiler's undirected knowledge semantics. Their
animated dash flow shows the Markdown mention path—from the containing entity
to the linked entity—rather than claiming a supplier/customer predicate. Motion
is disabled when the browser requests reduced motion.

Open **World** from the office launcher or command palette. The currently
selected Command Center project is used by default and can be changed in the
panel header. The starter and current offices expose the same panel through the
**Farplane Map** activity landmark. The Research Library remains dedicated to
the Docs Library.

See [feature registry](docs/feature-registry.md) and [QA runbook](docs/qa-runbook.md).
