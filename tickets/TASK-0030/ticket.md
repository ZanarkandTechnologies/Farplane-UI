---
ticket_id: TASK-0030
title: Redesign Thread Data into a mining run cockpit
phase: proof
status: review
owner: Farplane UI
claimed_by:
priority: high
depends_on:
  - TASK-0029
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-06-29
updated_at: 2026-06-29
next_action: reviewer closeout, then archive when accepted
last_verification: "2026-06-29: npm run test:once -- ui/src/components/hud/office-panel-registry.test.ts ui/src/store/app-store.test.ts ui/server ui/src/lib/mining ui/src/modules/thread-data; npx biome check --files-ignore-unknown=true ui/src/store/app-store.ts ui/src/store/app-store.test.ts ui/src/modules/thread-data ui/src/components/office-simulation.tsx ui/src/components/hud/office-panel-registry.ts ui/src/components/hud/office-panel-registry.test.ts ui/src/components/hud/office-menu.tsx ui/src/modules/office/panels/internal-panel-catalog.ts ui/src/modules/office/panels/use-internal-panel-launcher.ts ui/server ui/src/lib/mining ui/vite.config.ts; npm run typecheck:root; Playwright visual QA for populated cockpit, run selector dropdown, office panel launcher, restored Programs/Forking tabs, artifacts tab, attempts tab, and 390px mobile viewport passed."
---

# TASK-0030: Redesign Thread Data Into A Mining Run Cockpit

## Summary

Thread Data now sits on top of replayable `.farplane/mine/runs/<run-id>`
folders, but the UI still behaves like a thread-selection tool with separate
tabs for mine, runs, outputs, programs, and forking. Redesign it into a dense
mining run cockpit where the selected run is the primary object, artifacts are
inspectable without leaving the flow, and source selection/program editing are
secondary setup paths.

Recommended model: a run-first cockpit with a compact run selector in the
header, a full-width run workspace, and contextual drawers for run history,
artifacts, attempts, outputs, and scorecards.

## Functional UI Plan

```text
artifact: implementation handoff
decision: redesign Thread Data around mining runs, not thread tabs
primary_user: Farplane operator reviewing mining/backfill/ticket-completion results
primary_action: inspect a run, understand health, review outputs, and replay or promote findings
main_structural_change: make the selected mining run the persistent context and move source/program selection into setup drawers
grounding:
  - current UI: ui/src/modules/thread-data/components/thread-data-panel.tsx
  - current artifact contract: ui/src/modules/thread-data/README.md
  - mining API: ui/server/mining-local-api.ts
  - local comparable workflow: ui/src/modules/evals/components/eval-os-panel.tsx
```

## Users + Stories

- `Operator reviewing old chats:` I want to load recent mining runs, see which
  outputs need review, and promote/reject findings without hunting through
  tabs.
- `Operator testing ticket-completion scoring:` I want completed-ticket runs to
  surface scorecards and skipped-step evidence, not only generic JSON.
- `Operator debugging the harness:` I want to inspect `input.json`,
  `sources.json`, `attempts.json`, `report.md`, and per-output files from one
  place.
- `Operator replaying or tuning programs:` I want to compare attempt history
  and rerun from stored inputs so I can tell whether the run changed.

## Current UI Diagnosis

```text
primary_action:
  review one mining run from source selection through outputs and verdicts
current_failure:
  the UI exposes implementation tabs equally: Threads, Forking, Programs, Mine,
  Runs, Outputs. The run folder is the durable object, but it is not the
  workspace anchor.
state_gaps:
  - no attempt history view despite replay now writing attempts.json
  - no artifact explorer for input/sources/report/prompt/output files
  - no explicit mode/source badges for historical_backfill vs ticket_completion
  - no ticket scorecard renderer for ticket-completion outputs
  - empty/error/loading states are generic status text, not run-specific
information_hierarchy:
  first: selected run health, mode/source, review queue, replay status
  second: output list and selected output evidence
  hidden until needed: source selection, program prompt editor, raw JSON files
interaction_cost:
  operator must switch tabs to build context; Outputs are disconnected from the
  Runs report; Forking contract is a separate tab instead of an artifact panel.
content_ranges:
  min: no runs, no programs, no sources
  typical: 5-30 runs, 20-80 source rows, 1-20 outputs per run
  max: 200 source candidates, long prompts/reports, large JSON output bodies
diagnosis_sentence:
  The redesign should make reviewing a mining run obvious by anchoring the
  screen on the selected run and turning setup/artifacts into contextual panels.
```

## Comparable Apps

```text
Comparable apps
- Eval OS in this repo: run history + selected run summary + task/output detail
  proves the right local artifact dashboard pattern.
- CI run pages: persistent run header, status badges, job/output list, log
  drilldowns, and retry controls keep the run as the central object.
- IDE test runners: left run/test tree, center failure/detail pane, right raw
  output or stack/evidence view supports fast scan and drilldown.
- Data pipeline run monitors: attempt history and input/output artifacts are
  first-class because reruns need provenance.

Borrow
- header run selector with searchable dropdown
- sticky selected-run header
- metric strip for review/proof state
- output queue with verdict filters
- inspector drawer for raw artifact files and evidence
- replay attempt timeline

Avoid
- top-level tabs for every implementation noun
- making JSON/markdown the default presentation for ticket-completion scoring
- hiding replay state in raw attempts.json only
```

## Options Appendix

### Option A: Keep Tabs, Add Artifact Tab

```text
pros:
  - smallest diff
  - preserves current mental model
cons:
  - still thread/tab-first
  - run context remains split
  - artifact state becomes one more tab instead of the owner object
verdict: reject; too incremental for the new run-folder substrate
```

### Option B: Run Cockpit With Setup Drawers

```text
pros:
  - selected run is always visible
  - output review, replay, and artifacts share context
  - source/program setup can stay dense without dominating review
  - scales to ticket-completion scorecards and provider events
cons:
  - moderate component restructuring
  - needs careful empty/loading states
verdict: recommend
```

### Option C: Three Separate Mini Apps

```text
shape:
  - Programs app
  - Source Explorer app
  - Run Review app
pros:
  - clean ownership if features grow substantially
cons:
  - too much navigation for the current workflow
  - splits setup from review before the run model is mature
verdict: defer; maybe later if mining becomes its own OS surface
```

## Recommendation

Use Option B: a run cockpit.

Why it wins: the durable object is the mining run folder, and the operator's
real question is "what happened in this run and what should I do with it?"
Source selection and program editing are important, but they are setup tasks.
Reviewing output quality, ticket score, evidence, replay attempts, and artifact
provenance should stay in one selected-run context.

## ASCII Layouts

### Default Run Cockpit

```text
+----------------------------------------------------------------------------------+
| Mining Runs                         [Run: mine-mabc123] [Refresh] [New Run] [Replay] |
| status: loaded mine-mabc123 | .farplane/mine | 12 runs | 38 outputs | 9 open       |
+----------------------------------------------------------------------------------+
| RUN: Ticket completion audit (3 sources)                                         |
| mine-mabc123  ticket_completion / hook  complete                                |
| Created Jun 29 17:42  Last replay Jun 29 17:49                                  |
|                                                                                  |
| +---------+---------+----------+----------+--------------+                       |
| | sources | outputs | reviewed | privacy  | promoted     |                       |
| |   3     |   3     |    1     |    1     |     1        |                       |
| +---------+---------+----------+----------+--------------+                       |
|                                                                                  |
| [Outputs] [Artifacts] [Attempts] [Program] [Sources]                            |
|                                                                                  |
| OUTPUT REVIEW QUEUE                                                             |
| +----+----------------------+----------+----------+----------------------------+ |
| | !  | source               | ticket   | verdict  | summary                    | |
| +----+----------------------+----------+----------+----------------------------+ |
| | ok | TASK-0029 completed  | TASK-29  | promoted | implementation followed... | |
| | !! | TASK-0028 completed  | TASK-28  | review   | proof gap detected...      | |
| | ok | mining refactor chat | -        | reject   | duplicate finding...       | |
| +----+----------------------+----------+----------+----------------------------+ |
+----------------------------------------------------------------------------------+
```

### Run History Drawer

```text
+-------------------------------------------+
| Run History                               |
| 12 shown from 12 mining runs              |
+-------------------------------------------+
| [ Search runs__________________________ ] |
|                                           |
| > Ticket completion audit        complete |
|   mine-mabc123                            |
|   ticket_completion  3/3 outputs  1 priv  |
|                                           |
|   Decision mining                complete |
|   mine-k91d                               |
|   historical_backfill  20/20 outputs      |
+-------------------------------------------+
```

### New Run Setup Drawer

```text
+---------------------------------------------------------------+
| New Mining Run                                         [Start] |
+---------------------------------------------------------------+
| Program                                                       |
| [ Ticket completion audit v0.1        v ] [Edit prompt]       |
|                                                               |
| Mode                                                          |
| ( ) Historical chat mining  (x) Ticket completion  ( ) Manual |
|                                                               |
| Source filter                                                  |
| [ Search threads, tickets, paths___________________________ ] |
| Last days [30]   Limit [20]   [Select visible] [Clear]        |
|                                                               |
| Sources                                                       |
| +---+-------------------------+-------------+---------------+ |
| | x | TASK-0030 planning      | ticket file | completed     | |
| | x | TASK-0029 implementation| thread      | reviewed      | |
| |   | old chat mining         | thread      | historical    | |
| +---+-------------------------+-------------+---------------+ |
|                                                               |
| Run preview                                                   |
| Program: ticket-completion-audit-v1                           |
| Sources: 2 selected                                           |
| Artifacts: input.json, sources.json, attempts.json, outputs/* |
+---------------------------------------------------------------+
```

### Artifact Inspector

```text
+----------------------------------------------------------------------------------+
| RUN: mine-mabc123                                                        [Close]  |
+----------------------+-----------------------------------------------------------+
| ARTIFACTS            | input.json                                                |
| > input.json         | {                                                         |
|   sources.json       |   "mode": "ticket_completion",                            |
|   attempts.json      |   "source": "hook",                                       |
|   report.md          |   "programId": "ticket-completion-audit-v1",              |
|   parent-prompt.md   |   "sourceEventKey": "ticket:TASK-0030:completed"          |
|                      | }                                                         |
| outputs/             |                                                           |
|   TASK-0030/         | [Copy path] [Open raw] [Download]                         |
|   TASK-0029/         |                                                           |
+----------------------+-----------------------------------------------------------+
```

### Output Review Drawer

```text
+----------------------------------------------------------------------------------+
| TASK-0030 completed                                      clean | unreviewed       |
+----------------------------------------------------------------------------------+
| Scorecard                                                                          |
| +----------------------+----------------------+--------------------------------+ |
| | scope followed       | proof quality        | skipped steps                  | |
| | medium               | high                 | visual QA not run              | |
| +----------------------+----------------------+--------------------------------+ |
|                                                                                    |
| [Summary] [Evidence] [Telemetry] [Markdown] [JSON] [Redaction]                    |
|                                                                                    |
| Evidence                                                                           |
| +--------+-----------+---------------------------------------------------------+ |
| | span-1 | user      | okay lets create a separate ticket to handle UI...      | |
| | span-2 | assistant | created TASK-0030 with run cockpit ASCII plan...        | |
| +--------+-----------+---------------------------------------------------------+ |
|                                                                                    |
|                                               [Reject] [Needs Work] [Promote]     |
+----------------------------------------------------------------------------------+
```

### Empty State

```text
+----------------------------------------------------------------------------------+
| Mining Runs                                      [Refresh] [New Run]              |
+----------------------------------------------------------------------------------+
| No mining runs yet.                                                               |
|                                                                                  |
| Start by selecting a mining program and 1-20 sources. The run will create         |
| input.json, sources.json, attempts.json, report.md, and outputs/* under           |
| .farplane/mine/runs/<run-id>.                                                     |
|                                                                                  |
|                         [Create first mining run]                                 |
+----------------------------------------------------------------------------------+
```

## Key Screens / States

```text
screens:
  - MiningRunCockpit
  - RunHistoryDrawer
  - RunHeader
  - RunMetricsStrip
  - OutputReviewQueue
  - NewRunDrawer
  - ProgramEditorDrawer
  - ArtifactInspector
  - AttemptTimeline
  - OutputReviewDrawer
states:
  default:
    - latest run selected
    - output queue sorted by unreviewed, privacy issues, newest
  loading:
    - run selector disabled or loading label
    - selected-run header skeleton
    - disable replay/promote while loading
  empty:
    - no runs: show create-first-run path
    - no outputs in selected run: show run metadata and artifact links
    - no programs: show seed/default program recovery
  error:
    - API unavailable
    - run not found
    - replay failed
    - promote blocked by redaction
  success:
    - run created selects itself
    - replay appends attempt and refreshes current run
    - verdict update refreshes counts in header and rail
  permission:
    - write actions disabled or show forbidden if bridge write access fails
edge_cases:
  - many runs: virtualized or paginated rail
  - long output JSON: preserve scroll, wrap text, keep action bar sticky
  - unsafe/redacted output: promote disabled with visible reason
  - ticket-completion run: show scorecard tab first
  - generic historical run: show summary/evidence first
```

## Interaction Rules

```text
run_selection:
  - the header selector opens a searchable dropdown
  - selecting a run closes the drawer and updates header, metrics, output queue,
    artifact tabs, and URL search param if Thread Data supports deep links later
  - latest run auto-selects on refresh unless the operator has an active run
new_run:
  - New Run opens a drawer; it does not navigate away from current run
  - source defaults: newest 10 visible sources if none selected
  - mode defaults from source type when event/ticket sources are present
replay:
  - Replay is available only when a run is selected
  - replay writes attempt history and refreshes the current run in place
  - attempts tab highlights the newest attempt after replay
output_review:
  - opening an output uses a drawer so the run queue remains behind it
  - ticket-completion outputs default to Scorecard/Summary
  - historical decision outputs default to Decisions/Evidence
  - Promote is disabled for `redactionStatus !== clean`
artifacts:
  - artifact inspector opens raw files from run detail payload first
  - raw paths are visible, shortened for display, and copyable
keyboard:
  - `/` focuses run/output search when the relevant drawer or tab is active
  - `j/k` move output selection when drawer is closed
  - `r` replays selected run only when focus is not in an input
```

## Change Plan

### Change 1: Restructure Thread Data Around Selected Run

```text
fixes:
  - current top-level tabs split one run workflow into unrelated surfaces
before:
  - Threads/Mine/Runs/Outputs/Programs/Forking are peers
after:
  - selected run is the page anchor; setup and artifact surfaces are drawers or
    nested run tabs
read:
  - path: ui/src/modules/thread-data/components/thread-data-panel.tsx
    reason: current state owner and rendering surface
  - path: ui/src/modules/evals/components/eval-os-panel.tsx
    reason: local run-artifact comparable pattern
write:
  - path: ui/src/modules/thread-data/components/thread-data-panel.tsx
    change: split into cockpit shell, run-history selector drawer, run header,
      setup drawer, artifact inspector, and output drawer
  - path: ui/src/modules/thread-data/lib/mining-artifacts.ts
    change: add run grouping/filter helpers, artifact labels, attempt shaping,
      and output default-tab selection
operation:
  - keep current `/farplane/mine/*` API calls
  - keep program/source/run/output data types, add view-model helpers only
signature_or_type_impact:
  - optional `ThreadDataAttempt` type if attempts are exposed by API detail
  - optional `ThreadDataArtifact` view model for artifact inspector
routes:
  docs: update_docs
  qa: tests + visual-qa
  review: reviewer
qa:
  - helper tests for sorting/filtering/default tab behavior
  - smoke render test for empty state and populated run state if practical
failure_modes:
  - hiding source selection too much could make run creation harder; keep New
    Run drawer dense and predictable
```

### Change 2: Add Artifact And Attempt Inspection

```text
fixes:
  - run folders are the source of truth but the UI does not expose the folder
    shape directly
before:
  - report and parent prompt appear in separate areas; input/sources/attempts
    are not first-class
after:
  - Artifacts tab/drawer shows input, sources, attempts, report, parent prompt,
    and output files with readable labels
read:
  - path: ui/server/mining-local-api.ts
    reason: current run detail payload and available artifact fields
  - path: ui/src/modules/thread-data/types.ts
    reason: add attempt/artifact view types if needed
write:
  - path: ui/src/modules/thread-data/types.ts
    change: include attempts/artifacts if server route exposes them
  - path: ui/server/mining-local-api.ts
    change: optionally include attempts and artifact index in readRun detail
operation:
  - if API does not yet return attempts, extend readRun to include
    `attempts.json` and artifact path labels
  - do not make browser read files directly; keep Vite/server API boundary
signature_or_type_impact:
  - `ThreadDataRunDetail.attempts?: ThreadDataAttempt[]`
  - `ThreadDataRunDetail.artifacts?: ThreadDataArtifact[]`
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - server API test proves attempts are returned after replay
  - UI helper test proves artifact tree labels are stable
failure_modes:
  - raw artifacts can get noisy; default to report/attempt summary and put raw
    JSON behind one click
```

### Change 3: Specialized Output Review For Ticket Completion

```text
fixes:
  - future ticket-completion scoring needs a readable scorecard, not only JSON
before:
  - output drawer has Markdown, Decisions, Evidence, JSON, Redaction tabs
after:
  - output drawer chooses Scorecard/Summary first for ticket-completion audit
    outputs, then Evidence, Telemetry, Markdown, JSON, Redaction
read:
  - path: ui/src/modules/thread-data/types.ts
    reason: current output JSON shape
  - path: ui/server/mining-output.ts
    reason: generated output fields and ticket-completion audit program
write:
  - path: ui/src/modules/thread-data/components/thread-data-panel.tsx
    change: add output renderer selection and ticket scorecard component
  - path: ui/src/modules/thread-data/lib/mining-artifacts.ts
    change: add safe scorecard extraction helpers
operation:
  - scorecard renderer should tolerate missing fields and fall back to summary
  - evidence remains visible for every score claim
signature_or_type_impact:
  - none required if parsed from `outputJson`; optional view model helper only
routes:
  docs: no_docs
  qa: tests + visual-qa
  review: reviewer
qa:
  - fixtures for complete scorecard, partial scorecard, generic output
  - visual QA for drawer at desktop and narrow widths
failure_modes:
  - overfitting to current dry-run output before true scorer exists; keep
    renderer tolerant and schema-light
```

## Done

```text
done_when:
  - Thread Data opens as a run cockpit with latest run selected when available
  - run selector dropdown, run header, metrics, output queue,
    artifact inspector, attempt timeline, and output review drawer are usable
    from one selected-run context
  - New Run drawer supports historical and ticket/event source setup without
    making source selection the whole page
  - replay attempt history is visible after replay
  - output review defaults to the right presentation for ticket-completion vs
    generic historical mining outputs
  - raw artifacts are inspectable without browser-side filesystem reads
  - empty/loading/error/permission states are explicit
  - visual QA screenshots show desktop and narrow layout with no overlapping
    text or broken scroll regions
```

## Implementation Result

```text
implemented:
  - Thread Data now opens as a run-first cockpit instead of a top-level tab set.
  - The header exposes a compact run selector plus Refresh, New run, and Replay
    actions.
  - The run selector dropdown lists mining runs with status, mode,
    source/output counts, and privacy issue hints.
  - The selected-run workspace shows run metrics plus Outputs, Artifacts,
    Attempts, Program, and Sources tabs.
  - New Run is a setup drawer with program selection, source filtering, source
    selection, and run preview counts.
  - Output Review is a drawer with Summary, Evidence, Decisions, Markdown,
    JSON, and Redaction views.
  - Ticket-completion runs default output review to Summary/scorecard instead
    of raw JSON.
  - The mining API readRun detail now returns inputJson, sourcesJson, attempts,
    and artifact previews so the browser never reads local files directly.
  - Replay refreshes the selected run and switches to Attempts so provenance is
    inspectable immediately.
  - The office speed dial, command palette, internal panel catalog, and object
    panel launcher now expose Thread Data as a first-class office panel.
  - Restored top-level Thread Data modes for Review, Programs, Sources, and
    Forking so program definition and branch/thread lineage are not hidden
    behind the selected-run cockpit.
  - Replaced the run-history side sheet with an in-panel run selector popover
    so selection stays above the office modal instead of rendering behind it.
  - Replaced the Forking table with a Thread Lineage graph using the existing
    GraphWorkbench component. Current graph edges connect threads to workspace,
    source-kind, session, and selected-run source nodes; true created/forked
    telemetry edges can plug into the same model next.
proof:
  - `npm run test:once -- ui/src/components/hud/office-panel-registry.test.ts ui/src/store/app-store.test.ts ui/server ui/src/lib/mining ui/src/modules/thread-data`
    passed: 6 files, 30 tests.
  - `npx biome check --files-ignore-unknown=true ui/server ui/src/lib/mining ui/src/modules/thread-data ui/vite.config.ts`
    plus the office launcher/store files passed.
  - `npm run typecheck:root` passed.
visual_qa:
  - passed. A temp mining run was created through `/farplane/mine/runs` using
    `FARPLANE_MINE_ROOT=ui/tmp/task0030-mine`, screenshots were captured, then
    the temp mine root was removed.
  - `tickets/TASK-0030/artifacts/thread-data-cockpit-desktop.png`
  - `tickets/TASK-0030/artifacts/thread-data-run-history-desktop.png`
  - `tickets/TASK-0030/artifacts/thread-data-artifacts-desktop.png`
  - `tickets/TASK-0030/artifacts/thread-data-attempts-desktop.png`
  - `tickets/TASK-0030/artifacts/thread-data-cockpit-mobile.png`
  - `tickets/TASK-0030/artifacts/thread-data-office-panel.png`
  - `tickets/TASK-0030/artifacts/thread-data-office-dropdown.png`
  - `tickets/TASK-0030/artifacts/thread-data-programs-tab.png`
  - `tickets/TASK-0030/artifacts/thread-data-forking-tab.png`
  - `tickets/TASK-0030/artifacts/thread-data-forking-graph.png`
  - run selector correction check: popover rect was `x=591`, `y=189`,
    `width=420`, `height=231`, `z=9999` inside the office panel.
  - office panel check: `__FARPLANE_QA__.listPanels()` included
    `thread-data`, `openPanel("thread-data")` returned true, the panel mounted
    at about `1291x754`, and the seeded run id was visible.
  - forking graph check: GraphWorkbench rendered in the office modal with a
    `968x542` SVG canvas, `88` nodes, `163` edges, nonblank circles/lines, and
    no relevant page errors.
  - mobile viewport check: `document.body.scrollWidth === window.innerWidth`
    and `document.documentElement.scrollWidth === window.innerWidth` at 390px.
residual_risk:
  - The component remains an existing large file; a later cleanup can split
    RunSelectorPopover, NewRunSheet, ArtifactInspector, and OutputReviewSheet into
    smaller components if the pre-push warning becomes a maintenance burden.
  - Project-local/team-local Thread Data is not implemented in this ticket.
    Recommended follow-up: expose a project-scoped Thread Data entry from Team
    Panel that filters sources/runs by selected project instead of showing the
    global mining corpus.
```

## QA Strategy

```text
qa_strategy:
  proof_weight: visual_qa
  checks:
    - npm run test:once -- ui/src/modules/thread-data ui/server
    - npx biome check --files-ignore-unknown=true ui/src/modules/thread-data ui/server ui/vite.config.ts
    - npm run typecheck:root
  manual:
    - start UI
    - open Thread Data
    - verify no-run empty state
    - create a mining run from New Run drawer
    - inspect output queue, artifacts, attempts, and output drawer
    - replay selected run and confirm attempt timeline updates
    - update one verdict and confirm metrics/rail counts refresh
  delegated_lanes:
    - visual-qa reviewer for desktop and narrow screenshots
    - reviewer lane for functional workflow and state coverage
  review:
    - rubric: run is the central context; source/program setup does not hide
      critical review actions; artifact/replay provenance is inspectable;
      dense tool UI remains scannable
      required_tas: TAS-B
  evidence:
    - screenshots or Playwright captures for empty state, populated run,
      artifact inspector, output drawer, and replay attempt update
    - focused test output
  goal_advisor_inputs:
    proof_route: visual QA plus focused Thread Data/server tests
    final_evidence: screenshots and test output linked from ticket progress
    final_checkpoint: reviewer verifies the cockpit follows this functional UI
      plan before closeout
  residual_risk:
    - true ticket score schema may evolve; keep scorecard renderer tolerant
      until scorer output stabilizes
```

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - ui/src/modules/thread-data/README.md
    - docs/HISTORY.md
  no_docs_reason:
  validation:
    - README documents the cockpit model and run-folder artifacts exposed in UI
```

## Links

- `depends_on:` `tickets/TASK-0029/ticket.md`
- `current_component:` `ui/src/modules/thread-data/components/thread-data-panel.tsx`
- `artifact_contract:` `ui/src/modules/thread-data/README.md`
- `local_comparable:` `ui/src/modules/evals/components/eval-os-panel.tsx`

## Notes

- `Functional UI source:` created with `functional-ui` skill.
- `Research grounding:` local product/user grounding and established workflow
  patterns. No external web research was needed because this is a repo-local
  operator tool and the comparable run-artifact pattern already exists in Eval
  OS.
- `Implementation hint:` do not add a second storage model. The UI should read
  and mutate through `/farplane/mine/*` and server-owned mining API routes.
- `2026-06-30 update:` Team Panel now exposes Thread Data as the single
  thread/mining entrypoint. The separate `Threads` tab was removed to avoid a
  duplicate lineage surface; thread review, programs, sources, and forking stay
  inside the in-panel Thread Data cockpit.
  Browser proof:
  `tickets/TASK-0030/artifacts/team-panel-thread-data-tab.png`.
