# Runtime Module Contract

This module owns Farplane UI runtime adapter selection and runtime bridge
contracts.

## Rules

- Import public runtime surfaces from `@/modules/runtime`.
- Keep provider/context names runtime-generic.
- Keep adapter-specific code in adapter files or adapter-specific folders.
- Keep Codex app-server bridge changes covered by runtime adapter tests.
- Do not leak runtime-specific capability assumptions into callers; callers
  should branch on `adapter.capabilities`.

## Test

- `npm run --workspace @farplane/ui build --`
- `npm run build`
