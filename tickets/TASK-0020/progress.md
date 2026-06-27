---
ticket_id: TASK-0020
title: Progress - Chat History Mining Programs Platform
created_at: 2026-06-28
updated_at: 2026-06-28
---

# TASK-0020 Progress

## 2026-06-28 Goal Packet Created

- Classified work as `active_goal`.
- Added `design.md` with Thread Data / Backfill Programs ASCII UI plan.
- Added `program.md` with metric, drift, budget, QA, and completion-review
  policy.
- Added `generated-goal-prompt.md` for native Goal execution.
- Approval state: approved by operator request to create a goal and implement.
- Next action: start implementation from the generated Goal Packet.

## 2026-06-28 Implementation + Proof

- Added first-party `thread-data` UI module and `/thread-data` route.
- Added Vite bridge endpoints for:
  - `GET/POST /farplane/backfill/programs`
  - `GET /farplane/backfill/threads`
  - `GET/POST /farplane/backfill/runs`
  - `GET /farplane/backfill/runs/:runId`
  - `POST /farplane/backfill/runs/:runId/outputs/:outputId/verdict`
- File-backed runtime root: `.farplane/backfill`.
- Final proof run: `.farplane/backfill/jobs/backfill-mqwl7gct`.
- Proof run properties:
  - mode: `dry-run`
  - outputs: 5
  - output JSON includes nonempty `evidenceSpans`
  - per-output `redaction.md` artifacts exist
  - report includes reviewed, promoted, rejected, rejected-source, privacy, and duplicate counts
  - promotion is blocked for `needs_review` redaction outputs
- Browser proof:
  - `.farplane/qa/TASK-0020/thread-data-backfill.png`
  - `.farplane/qa/TASK-0020/thread-data-runs.png`
  - `.farplane/qa/TASK-0020/thread-data-output.png`
  - `.farplane/qa/TASK-0020/browser-console.json`
  - `.farplane/qa/TASK-0020/qa-summary.json`
- Checks passed:
  - `npx biome check --files-ignore-unknown=true ui/src/modules/thread-data ui/src/AppRouter.tsx ui/src/shell/module-registry.ts`
  - `npm run typecheck:root`
  - `npm run test:once -- ui/src/modules/thread-data/lib/backfill-artifacts.test.ts`
- Known residual:
  - `npm run --workspace @farplane/ui typecheck` still fails from pre-existing unrelated errors outside `thread-data`.
- Review state:
  - first QA/completion lanes blocked scaffold output quality
  - implementation updated source spans, redaction reports, dry-run mode, review counts, Backfill tab, and privacy promotion gate
  - rerun QA passed with minor residual UI note; Promote now renders as outline
    while blocked by privacy review
  - final five-source proof run: `.farplane/backfill/jobs/backfill-mqwl7gct`
  - final completion review: TAS-A pass, no hard-gate failures

## 2026-06-27 Decision Projection Addendum

- Added TASK-0019-compatible `telemetryEvents` projection rows to generated
  backfill `output.json` artifacts.
- Each dry-run decision output now includes a compact `decision.observed` event
  with `source=chat_history_mining`, `sourceProgram=decision-v1`, `sessionId`,
  `threadId`, inferred `ticketId` when present, `decisionKind`, `summary`,
  `eventKey`, `eventAt`, `reviewRunPath`, and cited `evidenceSpanIds`.
- Added `ticketId` and session columns to the Thread Data Outputs table.
- Tightened output drawer wrapping for long artifact paths.
- Fresh proof run: `.farplane/backfill/jobs/backfill-mqwux4my`.
- Proof run properties:
  - mode: `dry-run`
  - sources: 10
  - outputs: 10
  - privacy issues: 6
  - first output inferred `ticketId=TASK-0221`
  - first output includes `telemetryEvents[0].eventName=decision.observed`
- Browser proof:
  - `.farplane/qa/TASK-0020/thread-data-backfill-latest.png`
  - `.farplane/qa/TASK-0020/thread-data-runs-latest.png`
  - `.farplane/qa/TASK-0020/thread-data-output-latest.png`
  - `.farplane/qa/TASK-0020/browser-console-latest.json`
- Checks passed:
  - `npm run test:once -- ui/src/modules/thread-data/lib/backfill-artifacts.test.ts`
  - `npm run typecheck:root`
  - `npx biome check --files-ignore-unknown=true ui/src/modules/thread-data ui/vite.config.ts`

## 2026-06-27 Evidence View

- Kept `decision-v1` extraction output minimal while adding an output drawer
  Evidence view backed by `output.json.evidenceSpans`.
- Evidence view shows compact cards with span id, role, evidence text, and
  source pointer.
- Browser proof:
  - `.farplane/qa/TASK-0020/thread-data-evidence-latest.png`
  - `.farplane/qa/TASK-0020/browser-console-evidence-latest.json`
- Checks passed:
  - `npm run test:once -- ui/src/modules/thread-data/lib/backfill-artifacts.test.ts`
  - `npm run typecheck:root`
  - `npx biome check --files-ignore-unknown=true ui/src/modules/thread-data ui/vite.config.ts`

## 2026-06-27 Minimal Decision Extractor Contract

- Corrected `decision-v1` to treat `decisions.json` as the product output, not
  a generalized report.
- Bumped `decision-v1` to `1.1.0`.
- Minimal decision object shape:
  - `title`
  - `problem`
  - `options`
  - `recommendation`
  - `ticketId?`
  - `sessionId`
  - `decisionKind`
  - `confidence`
- Updated the bundled and local program prompt to require only a JSON array of
  those objects, returning `[]` when no real decision exists.
- Fresh proof run: `.farplane/backfill/jobs/backfill-mqwwg5u6`.
- Example raw array artifact:
  `.farplane/backfill/jobs/backfill-mqwwg5u6/outputs/019f09c7-a626-7601-bde0-3c1f3be1e155/decisions.json`
- Checks passed:
  - `npm run test:once -- ui/src/modules/thread-data/lib/backfill-artifacts.test.ts`
  - `npm run typecheck:root`
  - `npx biome check --files-ignore-unknown=true ui/src/modules/thread-data ui/vite.config.ts`

## 2026-06-27 Decision Title + Evidence Hardening

- Added generated `title` to `decision-v1` decision objects.
- Updated bundled and local `decision-v1` program prompt so the product output
  remains a minimal JSON array with `title`, `problem`, `options`,
  `recommendation`, `ticketId?`, `sessionId`, `decisionKind`, and `confidence`.
- Hardened the Evidence tab display by redacting local `/Users/<name>` prefixes
  to `~`.

## 2026-06-28 Refactor + Hardening Pass

- Extracted Evidence tab parsing and source redaction from the panel component
  into `thread-data` artifact helpers.
- Added unit coverage for local user-prefix redaction and malformed/empty
  evidence span filtering.
- Re-ran focused proof:
  - `npm run test:once -- ui/src/modules/thread-data/lib/backfill-artifacts.test.ts`
  - `npm run typecheck:root`
  - `npx biome check --files-ignore-unknown=true ui/src/modules/thread-data ui/vite.config.ts`
- Residual risk: operator-only raw JSON artifacts may still include local source
  paths because `output.json` is the provenance/debug envelope. The decision
  product output stays minimal in `decisions.json`, and the Evidence tab
  display redacts local user prefixes.

## 2026-06-27 Decision Output Shape Correction

- Corrected `decision-v1` dry-run outputs so `output.json.decisions` is the
  canonical structured array for decision miner results.
- Added `decisions.json` as the raw per-chat decision array artifact for
  `decision-v1`.
- Added Markdown / Decisions / JSON / Redaction view modes to the output drawer.
- `decision-v1` now emits an empty `decisions: []` array when the bounded
  source window does not contain a decision-shaped signal.
- `decision.observed` telemetry projection rows are only generated when a
  decision row exists.
- Automation, Telegram routing, and Codex delegation wrapper rows are excluded
  from the dry-run decision heuristic.
- De-duped merged backfill thread sources before run creation and hardened
  table keys for older duplicated output artifacts.
- Fresh proof run: `.farplane/backfill/jobs/backfill-mqwvsbmu`.
- Browser proof:
  - `.farplane/qa/TASK-0020/thread-data-decisions-array-latest.png`
  - `.farplane/qa/TASK-0020/thread-data-output-envelope-json-latest.png`
  - `.farplane/qa/TASK-0020/browser-console-decisions-array-latest.json`
- Checks passed:
  - `npm run test:once -- ui/src/modules/thread-data/lib/backfill-artifacts.test.ts`
  - `npm run typecheck:root`
  - `npx biome check --files-ignore-unknown=true ui/src/modules/thread-data ui/vite.config.ts`
