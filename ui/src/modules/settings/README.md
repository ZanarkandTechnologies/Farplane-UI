# Settings Module

## Purpose

Operator settings for Farplane UI. This module owns the settings dialog shell,
settings panels, and runtime-specific settings helpers.

## Public API

- `SettingsDialog`

Import from `@/modules/settings`.

## Boundaries

- Keep runtime-specific settings conditional on `RuntimeAdapterKind` and
  adapter capabilities.
- Keep settings persistence helpers in their owning domain library until a
  setting becomes module-private.
- Do not add unrelated HUD or launcher behavior here.

## Test

```bash
npm run --workspace @farplane/ui build --
npm run build
```
