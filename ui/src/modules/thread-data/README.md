# Thread Data

Thread Data is the mining run cockpit for Codex threads and other Farplane
event sources. The selected `.farplane/mine/runs/<run-id>` folder is the
workspace anchor; source selection and program editing are setup paths, while
run review, artifacts, attempts, outputs, evidence, and verdicts stay in one
run context. Run switching is handled by the header selector and searchable
run-history drawer so the active run workspace can use the full panel width.

## Runtime Contract

- `.farplane/mine/programs/index.json`
- `.farplane/mine/programs/<program-id>/program.json`
- `.farplane/mine/runs/index.json`
- `.farplane/mine/runs/<run-id>/run.json`
- `.farplane/mine/runs/<run-id>/input.json`
- `.farplane/mine/runs/<run-id>/sources.json`
- `.farplane/mine/runs/<run-id>/attempts.json`
- `.farplane/mine/runs/<run-id>/packet.json` for ticket-completion runs
- `.farplane/mine/runs/<run-id>/packet.md` for ticket-completion runs
- `.farplane/mine/runs/<run-id>/parent-prompt.md`
- `.farplane/mine/runs/<run-id>/report.md`
- `.farplane/mine/runs/<run-id>/outputs/<thread-id>/output.md`
- `.farplane/mine/runs/<run-id>/outputs/<thread-id>/output.json`
- `.farplane/mine/runs/<run-id>/outputs/<thread-id>/scorecard.json` for
  ticket-completion audits
- `.farplane/mine/runs/<run-id>/outputs/<thread-id>/scorecard.md` for
  ticket-completion audits

The Vite bridge exposes these through `/farplane/mine/*` for the browser, but
mining behavior is owned by `ui/server/mining-local-api.ts` and
`ui/server/mining-sources.ts`. Vite should stay a route shim: parse HTTP,
enforce bridge write access, call the local API, and return JSON.

## Boundaries

- Thread Data owns program CRUD, source selection, mining run creation, run history, artifact inspection, attempt inspection, and output review browsing.
- The run artifacts are the source of truth. UI state should be recoverable from files.
- Historical backfill is a mining run mode, not a separate storage system.
- Ticket-completion audits use a bounded packet contract: deterministic metrics
  are computed by local code, transcript context is included as a bounded window
  plus refs, and token usage remains `unknown` unless reliable session metadata
  exists.
- The first implementation writes local representative outputs and a parent-agent prompt. Long-running worker fan-out should consume the same run directory instead of adding a second storage model.
- The browser must not read local files directly. Artifact previews and attempt
  data come from the server-owned mining API behind `/farplane/mine/*`.
