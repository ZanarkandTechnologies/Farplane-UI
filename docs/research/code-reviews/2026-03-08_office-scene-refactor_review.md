# Code Review: Office Scene Refactor

## Summary
- Files reviewed: 13
- Critical issues: 0
- Important issues: 0
- Suggestions: 3

## Critical Issues (must fix)
- None.

## Important Issues (should fix)
- None.

## Suggestions
- Reduce duplicate theme observers by unifying `useOfficeSceneBackground` and `useOfficeSceneTheme` into one shared theme-state hook to avoid two `MutationObserver` instances on `document.documentElement`. (`ui/src/components/office-scene/use-office-scene-camera.ts:22`, `ui/src/components/office-scene/use-office-scene-camera.ts:46`)
- Strengthen type safety in object rendering by replacing repeated tuple casts (`as [number, number, number]`) with a narrow helper/validator for `OfficeObject` transforms. (`ui/src/components/office-scene/office-object-renderer.tsx:62`)
- Migrate deprecated Vitest config from `environmentMatchGlobs` to `test.projects` to avoid future breakage as Vitest upgrades. (`vitest.config.ts:9`)

## Strengths
- Coupling reduction is real: scene concerns are split into dedicated modules (`derived-data`, `interactions`, `bootstrap`, `camera`, `lighting`, `room shell`, `object renderer`) while keeping `office-scene.tsx` as a thin public shell.
- Behavior-critical logic appears preserved:
  - Nav bootstrap still waits on object registration and signals `onNavigationReady` through the same phase boundary.
  - CEO desk anchoring, wander-lock behavior, deterministic status assignment, and team-cluster desk lookup are preserved in extracted pure helpers.
  - Builder camera transition and dialog mounting behavior remain equivalent.
- Added derived-data unit tests are targeted and passing (`use-office-scene-derived-data.test.ts`).

## Recommended Actions
1. Keep this refactor as-is for correctness/type-safety gates.
2. Apply the suggestions if you want to tighten maintainability and future-proofing.
3. Add one focused behavior test around nav-grid readiness timing if startup regressions are still a concern.
4. Re-run review after any follow-up changes.
