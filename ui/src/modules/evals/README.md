# Eval OS

Eval OS is the global mini app for Farplane/Codex eval artifacts.

## Runtime Contract

- `.farplane/evals/runs/index.json`
- `.farplane/evals/runs/<job_id>/summary.json`
- `.farplane/evals/runs/<job_id>/tasks/<task_id>.json`
- `.farplane/evals/runs/<job_id>/tasks/<task_id>/agent_answer.txt`

The Vite bridge exposes these through `/farplane/evals/*` for the browser. Root precedence is:

1. `FARPLANE_EVALS_ROOT`, when explicitly set.
2. `${FARPLANE_FRAMEWORK_ROOT}/.farplane/evals`, when that framework root has `runs/index.json`.
3. `${REPO_ROOT}/.farplane/evals`, as the project-local fallback.

When the selected root has no eval artifacts yet, the module shows an empty state and manual JSON loading controls.

## Auto-Fetch Standard

Eval OS should auto-load the newest run using this order:

1. `GET /farplane/evals/runs`
2. Read `latest.job_id`, which is the first row from `.farplane/evals/runs/index.json`.
3. `GET /farplane/evals/runs/<job_id>` to load `summary.json` plus available task details and agent answers.
4. Render empty state only when the eval root or run index is missing.

The runner is the only writer for this directory in normal use. Manual JSON upload is a viewer fallback for imported reports, screenshots, and debugging, not the primary data path.

## Boundaries

- Eval OS owns run history, health, result drilldown, and report artifact viewing.
- Skill OS owns skill registry, template rollout, skill files, and skill-local eval definitions.
- Convex is intentionally out of scope until cloud/shared eval history is needed.
