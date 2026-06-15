# User Communications Module

Owns founder-facing Telegram gateway configuration surfaces.

## Rules

- Do not depend on shared board tasks for this module.
- Keep Telegram tokens and local gateway state out of browser code.
- UI may show gateway commands and local configuration, but the listener runs in Node.
- Prefer a compact configuration surface over chat transcripts in the product UI.

## Test

- `npm run test:once -- ui/src/modules/user-communications`
- `npm run --workspace @farplane/ui typecheck`
