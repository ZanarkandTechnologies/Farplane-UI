# Eval OS Module

- Owns global eval run viewing, run history, health scoring, task drilldown, and local report loading.
- Primary runtime source is `.farplane/evals/runs`; missing runtime files must render an empty state, not a fake pending run.
- Skill-local `eval_task.json` files belong in Skill OS file viewing. Eval OS may reference them, but does not own skill rollout controls.
- Keep this surface read-only for run artifacts. Mutating eval execution/storage needs a separate ticket.
- Use shadcn/Tailwind tokens and avoid nested modal scrolling.
