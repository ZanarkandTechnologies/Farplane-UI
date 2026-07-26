# World Map QA

## Deterministic fixture

The fixture project root is:

```text
ui/src/modules/world-map/fixtures/project
```

Its exact Core projection lives at `.farplane/entities/world.json`. The bridge can
be checked directly while the UI is running:

```text
GET /farplane/world?projectPath=<absolute fixture project path>
```

For full launcher QA, compile `world.json` in a project listed by the Command
Center company model, run `npm run ui`, then open **World** from the office
launcher or `Ctrl/Cmd+K` command palette.

## Checks

1. Select a project and verify counts for entities, plotted points, and associations.
2. Select `Malaysia Suppliers`; Penang Castings and Precision Alloys remain,
   while the association to Acme Motors disappears because both endpoints are
   not in the view. Select **All entities** to restore all three nodes and the association.
3. Search `PC Manufacturing`; only Penang Castings remains.
4. Filter `supplier`; Precision Alloys remains listed with the unlocated icon and no point.
5. Select Penang Castings, then its association; verify the exact source sentence and path.
6. Verify missing, invalid JSON, stale, and issue states using bounded fixture variants.
7. At desktop width the map dominates; at narrow width the dialog remains operable without page overflow.
8. Capture the panel, node detail, association detail, console log, and page errors.
9. With a URL-restricted public Mapbox token configured, verify
   `data-world-map-renderer="mapbox"`, a nonblank Mapbox canvas, monochrome night
   geography, vector labels, and selectable nodes/links. Capture WebGL2 support,
   the unmasked renderer when available, `load`/`idle`, canvas dimensions, and
   page errors. Do not force SwiftShader or software ANGLE for primary proof.
10. Delay provider config or first paint and verify
   `data-world-map-renderer="loading"`, a centered accessible loading status,
   and no blank or partially painted map. Remove the token or force a Mapbox
   pre-paint/context-loss error and verify `data-world-map-renderer="error"`,
   concise recovery copy, and an operable **Try again** action.
11. Verify the dashed mention flow moves from the containing
   entity toward the linked entity; emulate reduced motion and confirm the line
   remains dashed but static.
12. Verify the unlocated-only state leaves the basemap fully legible and uses a
   compact bottom notice rather than a full-canvas scrim.
13. Click the Farplane Map activity landmark and verify it opens the same World
   panel; confirm Research Library still opens Docs Library.
14. Select an entity with metadata-bearing timeline rows and verify generic
    key/value badges, date, and newest-first evidence. Confirm World does not
    assign risk, feasibility, or resource semantics. Select a linked target
    entity and verify the same row appears once with its source entity named.
15. Select an entity without timeline rows and verify the compact empty state;
    malformed additive timeline rows must be omitted without dropping nodes or
    associations.

## Automated checks

```bash
npx vitest run ui/src/modules/world-map/lib/map-renderer.test.ts ui/src/modules/world-map/lib/world-projection.test.ts ui/src/components/hud/office-panel-registry.test.ts
npm run ui:typecheck
npm run ui:build
```
