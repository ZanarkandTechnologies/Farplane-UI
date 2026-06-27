# Thread Data

Thread Data is the workbench for mining historical Codex threads with reusable prompt programs.

## Runtime Contract

- `.farplane/backfill/programs/index.json`
- `.farplane/backfill/programs/<program-id>/program.json`
- `.farplane/backfill/jobs/index.json`
- `.farplane/backfill/jobs/<run-id>/job.json`
- `.farplane/backfill/jobs/<run-id>/sources.json`
- `.farplane/backfill/jobs/<run-id>/parent-prompt.md`
- `.farplane/backfill/jobs/<run-id>/report.md`
- `.farplane/backfill/jobs/<run-id>/outputs/<thread-id>/output.md`
- `.farplane/backfill/jobs/<run-id>/outputs/<thread-id>/output.json`

The Vite bridge exposes these through `/farplane/backfill/*` for the browser.

## Boundaries

- Thread Data owns program CRUD, source selection, backfill job creation, run history, and output review browsing.
- The job artifacts are the source of truth. UI state should be recoverable from files.
- The first implementation writes local representative outputs and a parent-agent prompt. Long-running worker fan-out should consume the same job directory instead of adding a second storage model.
