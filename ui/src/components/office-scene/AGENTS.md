# Office Scene Module

## Boundaries
- Keep `office-scene.tsx` as the public scene entrypoint and canvas shell only.
- Put data shaping, bootstrap timing, and large render switches in this module folder.
- Avoid adding new scene-global store writes directly in presentational render components.

## Invariants
- Scene bootstrap is coordinated through explicit readiness signals, not ad hoc local loaders.
- Office object registration and nav-grid initialization stay coupled through one bootstrap hook.
- Pure derived scene data should remain testable without mounting React Three Fiber.

## Tests
- Prefer pure tests for derived-data helpers.
- Validate bootstrap behavior through focused unit tests before relying on browser-only checks.

## Conventions
- Major logic files need the standard header block.
- Keep extracted modules small and single-purpose; do not replace one god file with several medium god files.
