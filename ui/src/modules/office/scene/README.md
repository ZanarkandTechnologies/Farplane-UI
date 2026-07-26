# Office Scene

Purpose: internal modules that compose the 3D office scene without forcing `ui/src/modules/office/office-scene.tsx` to own every scene concern.

## Public API / entrypoints
- `ui/src/modules/office/office-scene.tsx` — public office scene component.
- `ui/src/modules/office/scene/scene-contents.tsx` — internal scene composition.
- `ui/src/modules/office/scene/office-render-policy.ts` — pure blocking-panel policy that suspends
  the retained Canvas while large operational surfaces obscure it and preserves live Story mode.

## Minimal example
- Import `OfficeScene` from `@/modules/office` and pass `teams`, `employees`, `desks`, and `officeObjects`.

## How to test
- `npm run test:once -- ui/src/modules/office/scene/use-office-scene-derived-data.test.ts`
- `npm run typecheck`
