# World Map Module

- Read `README.md`, `docs/feature-registry.md`, and `docs/qa-runbook.md` before changes.
- Keep the browser path read-only; Core owns compilation and Markdown writes.
- Preserve unlocated nodes in search results and never draw an edge unless both endpoints are plotted.
- Keep producer parsing at `lib/world-projection.ts`; components consume normalized types.
- Do not add cloud or database persistence here. Company aggregation composes project-qualified projections through the existing read bridge.
- Run the focused projection test, UI typecheck/build, and browser QA after user-visible changes.
