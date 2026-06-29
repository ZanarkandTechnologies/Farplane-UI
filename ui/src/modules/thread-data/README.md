# Thread Data

Thread Data is the workbench for mining Codex threads and other Farplane event
sources with reusable mining programs.

## Runtime Contract

- `.farplane/mine/programs/index.json`
- `.farplane/mine/programs/<program-id>/program.json`
- `.farplane/mine/runs/index.json`
- `.farplane/mine/runs/<run-id>/run.json`
- `.farplane/mine/runs/<run-id>/input.json`
- `.farplane/mine/runs/<run-id>/sources.json`
- `.farplane/mine/runs/<run-id>/attempts.json`
- `.farplane/mine/runs/<run-id>/parent-prompt.md`
- `.farplane/mine/runs/<run-id>/report.md`
- `.farplane/mine/runs/<run-id>/outputs/<thread-id>/output.md`
- `.farplane/mine/runs/<run-id>/outputs/<thread-id>/output.json`

The Vite bridge exposes these through `/farplane/mine/*` for the browser, but
mining behavior is owned by `ui/server/mining-local-api.ts` and
`ui/server/mining-sources.ts`. Vite should stay a route shim: parse HTTP,
enforce bridge write access, call the local API, and return JSON.

## Boundaries

- Thread Data owns program CRUD, source selection, mining run creation, run history, and output review browsing.
- The run artifacts are the source of truth. UI state should be recoverable from files.
- Historical backfill is a mining run mode, not a separate storage system.
- The first implementation writes local representative outputs and a parent-agent prompt. Long-running worker fan-out should consume the same run directory instead of adding a second storage model.
