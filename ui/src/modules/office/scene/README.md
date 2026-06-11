# Office Scene

Purpose: internal modules that compose the 3D office scene without forcing `ui/src/modules/office/office-scene.tsx` to own every scene concern.

## Public API / entrypoints
- `ui/src/modules/office/office-scene.tsx` — public office scene component.
- `ui/src/modules/office/scene/scene-contents.tsx` — internal scene composition.

## Minimal example
- Import `OfficeScene` from `@/modules/office` and pass `teams`, `employees`, `desks`, and `officeObjects`.

## How to test
- `npm run test:once -- ui/src/modules/office/scene/use-office-scene-derived-data.test.ts`
- `npm run typecheck`
