---
kind: system-spec
status: active
project: Farplane UI
created_at: 2026-08-12
updated_at: 2026-08-12
owner: office
source_refs:
  - ../../ui/src/lib/z-index.ts
  - ../../ui/src/lib/z-index.test.ts
  - ../../ui/src/modules/office/office-scene.tsx
  - ../../ui/src/components/office-simulation.tsx
---

# Z-Index System

The **Z-Index System** is the shared layering contract for the Office3D canvas,
its HTML overlays, the Office HUD, and portalled application panels. Its goal is
simple: a scene annotation remains inside the scene; it never paints over a HUD,
dialog, or workspace panel.

```ts
resolveLayer(surface, purpose) -> named UI_Z value | OFFICE_HTML_Z range
```

`ui/src/lib/z-index.ts` is the numeric source of truth. This document explains
how to select a layer; it must not become a second source for exact values.

## Layer Contract

| Layer | Current tier | Owns | Must stay below / above |
| --- | ---: | --- | --- |
| Scene canvas | `0` | The isolated React Three Fiber canvas | Below all Office HUD and panel surfaces |
| Debug HTML | `1–20` | Builder coordinates and diagnostics | Above the canvas, below all ordinary labels |
| Scene labels | `21–50` | Rooms, teams, employees, object, and specialist labels | Above debug HTML, below status overlays |
| Status HTML | `51–90` | Activity, pinned-state, and ticket dispatch status | Above labels, below in-world controls |
| Scene controls | `91–130` | In-world radial/context menus | Above scene annotations, below HUD chrome |
| Scene HUD | `200–220` | Menu, stats, builder toolbar, and transient HUD controls | Above the entire canvas stack |
| Application panels | `1200+` | Dialogs, drawers, and workspace panels | Above Office3D and its HUD |

The scene canvas establishes an isolated stacking context at `UI_Z.sceneCanvas`.
That containment is required even when an overlay has a bounded range: children
cannot out-rank siblings outside their parent's stacking context.

## Usage Rules

1. Use `UI_Z` for regular DOM surfaces. Do not add raw numeric z-index values
   to Office HUD, dialog, drawer, or panel code.
2. Every `@react-three/drei` `Html` overlay in `ui/src/modules/office/` must
   set `zIndexRange={OFFICE_HTML_Z.<tier>}`. Never rely on Drei's default range.
3. Pick the lowest tier that keeps the in-scene interaction understandable:
   `debug`, `label`, `status`, then `control`.
4. A new root layer needs a named token, a documented ordering reason, and a
   test that keeps its range below the next owning surface. Do not increase an
   existing maximum to solve overlap.
5. Portal-backed panels use the panel tiers even if their trigger originates
   inside `Html`; their document-level stacking must remain independent of the
   canvas.

## Examples

```tsx
// A room identity is a passive scene label.
<Html zIndexRange={OFFICE_HTML_Z.label}>...</Html>

// A worker's current task needs priority over labels, not over the HUD.
<Html zIndexRange={OFFICE_HTML_Z.status}>...</Html>

// The Office menu is application chrome, not scene content.
<div style={{ zIndex: UI_Z.sceneHud }}>...</div>
```

## Verification

- Run `corepack pnpm --filter @farplane/ui exec vitest run src/lib/z-index.test.ts`.
- Confirm every Office `Html` overlay uses `OFFICE_HTML_Z`.
- In `/office`, open a scene-rich state and then a Settings or workspace panel.
  Labels must remain visible in the scene and never appear above the panel.

When the tier order changes, update this document and the focused test in the
same change.
