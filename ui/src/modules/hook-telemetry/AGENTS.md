# Hook Telemetry UI Module

## Boundaries

- Own raw hook telemetry event inspection, hook setup guidance, and hook config previews.
- Do not own runtime agent-hour usage math; that stays in `ui/src/modules/telemetry`.
- Keep product-specific bubble/navigation projections in Convex projection reducers or office providers.

## Tests

- Prefer pure tests for formatting and distribution helpers.
- Use browser QA for panel density and launcher regressions when visual layout changes.
