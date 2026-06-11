# UI Modules Contract

This folder owns Farplane UI product modules. Modules are reusable operator
surfaces, not generic file buckets.

## Read Order

1. `../../../PROJECT_RULES.md`
2. `README.md`
3. Module-local `AGENTS.md`
4. Module-local `docs/feature-registry.md`
5. Module-local `docs/qa-runbook.md`

## Rules

- Add one folder per reusable operator workflow or route-mounted product
  surface.
- Keep module UI, hooks, local logic, types, fixtures, tests, and docs inside
  the owning module.
- Keep internal helpers private unless exported through the module `index.ts`.
- Keep shadcn-style primitives in `ui/src/components/ui`, global app state in
  `ui/src/store`, and tiny cross-module primitives in `ui/src/lib`.
- Put durable cross-module domain behavior in an owning module, not in
  `ui/src/lib`.
- Do not add product/domain folders outside `ui/src/modules`.
- Keep runtime-specific code behind runtime adapter folders or module-local
  runtime panels.
- Register renderable modules explicitly at the app entrypoint, launcher
  registry, or route table that owns the launch surface.
- Keep README and AGENTS short; put detailed behavior in module-local `docs/`.

## Migration Guidance

- Prefer moving code into a module when the file is already being touched for
  behavior work.
- Move one workflow surface at a time: shell, hooks, helpers, tests, docs, then
  public exports.
- Leave compatibility re-export shims only when many imports would otherwise
  churn; delete those shims once call sites have migrated.
- Do not turn migration into a broad rename-only diff unless a ticket asks for
  that exact cleanup.

## Test

- `npm run ui:build`
- `npm run build`
- Browser QA for scene, settings, chat, or route-mounted module changes.
