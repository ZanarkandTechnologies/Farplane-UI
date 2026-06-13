# Convex Module Contract

This folder owns the shared Convex backend deployment for Farplane office runtime surfaces.

## Rules

- Read `convex/_generated/ai/guidelines.md` before editing Convex code.
- Keep backend work modular under `convex/modules/<moduleName>/` when it belongs
  to one Farplane runtime, office, telemetry, memory, or indexing domain.
- Compose module table definitions from `convex/schema.ts`; do not create
  competing schema entrypoints.
- Prefer module-prefixed table names for module-owned data.
- Keep shared tables explicit and rare.
- Always use Convex validators for public and internal functions.
- Prefer reusable validators plus `Infer<typeof validator>` for module-owned
  TypeScript types. Avoid hand-written duplicate unions or object shapes when a
  Convex validator already defines the contract.
- Group module-owned functions by feature or table boundary, not by Convex
  function kind. Prefer files such as `useCases.ts`, `variants.ts`, or
  `workflows.ts` that colocate related queries, mutations, and actions over
  generic `actions.ts`, `queries.ts`, or `internal.ts` buckets.
- Keep authorization server-derived through `ctx.auth.getUserIdentity()`.
- Do not run local computer-vision inference inside Convex.
- Sandbox-style command execution in Convex must be described as virtualized
  unless it explicitly uses a VM/container/host runtime boundary. See `MEM-0013`.

## Test

- `npx tsc -p convex/tsconfig.json --noEmit`
- targeted `npm run test:once -- convex/<test-file>.test.ts`
- `npm run lint`
- targeted Convex function checks when a ticket adds backend behavior
