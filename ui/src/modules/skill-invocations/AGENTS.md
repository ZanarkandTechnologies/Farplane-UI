# Skill Invocations Module Contract

## Boundaries

- Own the operator UI for Codex skill invocation telemetry.
- Render Convex-provided summaries and recent `Read skill MD` events.
- Do not read local `~/.codex` files from the browser.

## UI

- Keep the surface compact and operational: metrics, breakdowns, recent rows, and clear empty/error states.
- Use shared theme tokens and existing shadcn-style primitives.

## Test

- `npm run test:once -- skill-invocations`
- Browser QA through the office launcher.
