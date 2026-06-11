# QA Agents

Read this file before browser QA.

## Rules

- Start from `qa/README.md`, then the relevant `qa/cookbook/*` page.
- Prefer deterministic shortcuts, deep links, seeded state, and debug bridges
  over wandering through the UI.
- Use Playwright for stable regression paths.
- Use `agent-browser` for discovery, evidence capture while the flow is in
  flux, and debugging failed Playwright coverage.
- If a workflow is hard to prove, document the missing instrumentation in the
  QA report and ticket instead of normalizing brittle manual clicking.
- UI work is not done until the result can be inspected or proven through a
  repeatable path.

## Evidence

- Capture screenshots, console/errors, and a compact report for meaningful UI
  changes.
- Mark unprovable acceptance criteria as `NOT PROVABLE`; do not infer success
  from intent.
- Link artifacts back to the ticket.
