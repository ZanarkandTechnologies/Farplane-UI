# Project Artefacts Convex Module Contract

## Boundaries

- Own the bounded Convex metadata index for project workspace artefacts.
- Keep root `convex/team_artefacts.ts` as a compatibility entrypoint until UI callers migrate.

## Rules

- Workspace files remain canonical outside Convex.
- Convex stores refreshable metadata only, not file contents.
- Refreshes are explicit and bounded.

## Test

- `npx tsc -p convex/tsconfig.json --noEmit`
