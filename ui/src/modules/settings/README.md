# Settings Module

## Purpose

Operator settings for Farplane UI. This module owns the settings dialog shell,
feature-default panels, and runtime-specific settings helpers.

## Public API

- `SettingsDialog`

Import from `@/modules/settings`.

## Boundaries

- Keep runtime-specific settings conditional on `RuntimeAdapterKind` and
  adapter capabilities.
- Keep settings persistence helpers in their owning domain library until a
  setting becomes module-private.
- Persist only non-secret operator settings in `~/.farplane/config.toml`.
  Credential rows consume environment-injected values and, when missing, show
  the exact value-free Doppler setup and relaunch commands.
- Put new cross-feature settings in `cli/operator-settings.ts` before adding a
  UI control, so CLI callers and the state bridge resolve the same contract.
- Do not add unrelated HUD or launcher behavior here.

## Test

```bash
npm run --workspace @farplane/ui build --
npm run build
```
