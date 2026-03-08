# Office Scene

Purpose: internal modules that compose the 3D office scene without forcing `ui/src/components/office-scene.tsx` to own every scene concern.

## Public API / entrypoints
- `ui/src/components/office-scene.tsx` — public office scene component.
- `ui/src/components/office-scene/scene-contents.tsx` — internal scene composition.

## Minimal example
- Import `OfficeScene` from `ui/src/components/office-scene.tsx` and pass `teams`, `employees`, `desks`, and `officeObjects`.

## How to test
- `npm run test:once -- ui/src/components/office-scene/use-office-scene-derived-data.test.ts`
- `npm run typecheck`
