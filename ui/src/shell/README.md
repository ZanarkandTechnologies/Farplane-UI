# Farplane UI Shell

`ui/src/shell` owns renderer composition for Farplane UI.

## Contract

```text
FarplaneUiConfig -> renderer + module registry -> user entrypoints
```

Renderers decide how users enter modules:

- `standard`: navigation-first web UI.
- `office3d`: spatial 3D office UI.

Modules own what features do. The shell owns composition, launch surfaces,
renderer choice, and the registry that makes enabled modules visible to a
renderer.

## Planned Shape

```text
shell-config.ts
module-registry.ts
FarplaneShell.tsx
renderers/
  standard/
  office3d/
```

The first implemented seam wraps the current standard app and 3D office
composer behind shell renderers. A later refactor can move the internals of the
3D office composer into `renderers/office3d` while preserving the old import
path as a compatibility shim.

## Rules

- Do not add a `console` module; use the `standard` renderer.
- Do not dynamically load first-party modules in this slice; use static imports.
- Derive module id types from the registry.
- Keep module feature logic inside `ui/src/modules/*`.
- Keep shared helpers in `ui/src/lib` only after real cross-module reuse.
