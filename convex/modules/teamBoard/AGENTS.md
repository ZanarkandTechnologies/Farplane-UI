# Team Board Convex Module Contract

## Boundaries

- Own project task state, board events, task-lifecycle commands, and board timeline queries.
- Keep the root `convex/board.ts` file as a compatibility entrypoint until UI callers migrate.
- Use agent activity tables only for joined activity timelines and membership checks.

## Rules

- Every task write must preserve append-only board event history.
- `activity_log` commands write agent activity rows instead of board task rows.
- Keep permission checks server-side in the command mutation.

## Test

- `npm run test:once -- convex/board_contract.test.ts convex/board_http_contract.test.ts`
- `npx tsc -p convex/tsconfig.json --noEmit`
