# Eval OS Module

- Owns global eval run viewing, run history, health scoring, task drilldown, and local report loading.
- Primary runtime source is `.farplane/evals/runs`; missing runtime files must render an empty state, not a fake pending run.
- Portable skill suites at `evals/evals.json` belong in Skill OS file viewing. Eval OS owns the distinct runner-native global harness run model, not skill-local definitions.
- Keep this surface read-only for run artifacts. Mutating eval execution/storage needs a separate ticket.
- Use shadcn/Tailwind tokens and avoid nested modal scrolling.
