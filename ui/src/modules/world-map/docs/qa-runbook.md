# World Map QA

## Deterministic fixture

The fixture project root is:

```text
ui/src/modules/world-map/fixtures/project
```

Its exact Core projection lives at `.farplane/crm/world.json`. The bridge can
be checked directly while the UI is running:

```text
GET /farplane/world?projectPath=<absolute fixture project path>
```

For full launcher QA, compile `world.json` in a project listed by the Command
Center company model, run `npm run ui`, then open **World** from the office
launcher or `Ctrl/Cmd+K` command palette.

## Checks

1. Select a project and verify counts for entities, plotted points, and associations.
2. Search `PC Manufacturing`; only Penang Castings remains.
3. Filter `supplier`; Precision Alloys remains listed with the unlocated icon and no point.
4. Select Penang Castings, then its association; verify the exact source sentence and path.
5. Verify missing, invalid JSON, stale, and issue states using bounded fixture variants.
6. At desktop width the map dominates; at narrow width the dialog remains operable without page overflow.
7. Capture the panel, node detail, association detail, console log, and page errors.
8. Verify Dark Matter tiles visibly paint and the dashed mention flow moves from
   the containing entity toward the linked entity; emulate reduced motion and
   confirm the line remains dashed but static.
9. Click the Farplane Map activity landmark and verify it opens the same World
   panel; confirm Research Library still opens Docs Library.

## Automated checks

```bash
npx vitest run ui/src/modules/world-map/lib/world-projection.test.ts ui/src/components/hud/office-panel-registry.test.ts
npm run ui:typecheck
npm run ui:build
```
