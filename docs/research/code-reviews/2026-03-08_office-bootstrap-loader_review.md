# Code Review: Office Bootstrap Loader Refactor

## Summary
- Files reviewed: 5
- Critical issues: 1
- Important issues: 1
- Suggestions: 0

## Critical Issues (must fix)
### Issue 1: Unstable callback dependency causes repeated grid-init effect resets
- **File**: `ui/src/components/office-simulation.tsx:117`, `ui/src/components/office-scene.tsx:494`
- **Confidence**: 96
- **Problem**: `onNavigationReady={() => setNavigationReady(true)}` creates a new function each render. `SceneContents` includes `onNavigationReady` in the grid-init `useEffect` dependency list, so the effect is torn down and recreated on every parent render. This continuously resets the 500ms timer and can delay or starve navigation readiness under render churn.
- **Fix**: Memoize the callback in `OfficeSimulation` with `useCallback` and pass the stable reference; keep the effect dependency in `office-scene` only if the callback is stable.

## Important Issues (should fix)
### Issue 1: Loader can deadlock on navigation stage when expected obstacles are not yet registered at timer fire
- **File**: `ui/src/components/office-scene.tsx:484`
- **Confidence**: 88
- **Problem**: In the `expectedCount > 0 && objects.length > 0` branch, if `objects.length` is still `0` at the 500ms check, neither `initializeGrid` nor `onNavigationReady` runs. Since dependencies only track `allOfficeObjects?.length`, `ceoDeskData`, `getObjects`, and callback identity, late object registration may not retrigger the effect. In that state, `navigationReady` stays false and the global loader remains visible indefinitely.
- **Fix**: Add an explicit fallback path when `expectedCount > 0 && objects.length === 0` (retry loop with bounded attempts, or initialize grid with current objects and signal ready once) and ensure readiness cannot stay permanently false.

## Strengths
- `office-bootstrap.ts` cleanly centralizes stage ordering and readiness composition with simple pure functions.
- `a-star-pathfinding.ts` one-time warning guard reduces log spam without masking actual initialization state.
- `office-loader.tsx` provides clear user-visible stage feedback and integrates progress without coupling to subsystem internals.

## Recommended Actions
1. Stabilize `onNavigationReady` with `useCallback`.
2. Add deterministic recovery for the `expectedCount > 0 && objects.length === 0` startup case.
3. Re-test loader behavior with slow-mount custom meshes and high render churn.
4. Re-run this review after fixes.
