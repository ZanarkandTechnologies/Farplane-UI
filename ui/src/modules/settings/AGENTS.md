# Settings Module Contract

This module owns Farplane UI settings panels and runtime-specific settings
forms.

## Rules

- Import the public dialog from `@/modules/settings`.
- Keep panel-only helpers module-local.
- Branch runtime-specific controls on the selected runtime, not on stale
  OpenClaw-first assumptions.
- Keep settings copy terse; controls should explain themselves through labels
  and layout.

## Test

- `npm run --workspace @farplane/ui build --`
- `npm run build`
