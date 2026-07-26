# Eval OS Module

- Owns global eval run viewing, run history, health scoring, task drilldown, and local report loading.
- Render schema-v2 benchmark aggregates, candidate/baseline comparisons, assertion evidence, timing, tokens, and behavior traces when present; retain graceful schema-v1 reading.
- Primary runtime source is `.farplane/evals/runs`; missing runtime files must render an empty state, not a fake pending run.
- Portable skill suites at `evals/evals.json` remain authored beside each skill. Eval OS reads the generated run artifacts and does not redefine suite semantics.
- Keep this surface read-only for run artifacts. Mutating eval execution/storage needs a separate ticket.
- Use shadcn/Tailwind tokens and avoid nested modal scrolling.
