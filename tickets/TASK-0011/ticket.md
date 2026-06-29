---
ticket_id: TASK-0011
title: Redesign Team Panel Into Autonomous Work Cockpit
phase: review
status: review
owner: Farplane UI
claimed_by: Codex
priority: high
depends_on: []
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-06-25
updated_at: 2026-06-25
next_action: Kenji Review seven-tab cockpit prototype and decide polish/data-adapter follow-ups
last_verification: 2026-06-25; admission review, focused tests/build/diff, desktop/mobile browser proof passed for seven-tab cockpit; local /office emitted backend 502 and headless WebGL console noise
---

# TASK-0011: Redesign Team Panel Into Autonomous Work Cockpit

## Summary
Redesign the Team Panel from a 14-tab artifact cabinet into a scoped cockpit for
autonomous team work. Keep `Overview` as the first tab, move usage and AI burn
there, preserve Kanban as the primary work surface, consolidate weak or
placeholder tabs into source-honest operator workflows, and prototype `Goals` as
a game-inspired campaign surface that makes autonomous progress feel inspectable
instead of abstract.

This ticket is the functional UI handoff for the redesign. It does not authorize
claiming weekly progress from inferred or fake data; every card must declare its
canonical source, fallback source, freshness, drill-down, and empty/error state.
The first approved Goal-backed slice is the `Goals` tab prototype only.

## Scope
- `In:`
  - Reduce the top-level Team Panel tabs to:
    `Overview`, `Kanban`, `Goals`, `Pulse`, `Proof`, `Memory`, and `Config`.
  - Keep `Overview` as the landing tab and include usage / AI burn summary there.
  - Keep `Kanban` as the primary operational work tab with a compact weekly goal
    strip and board status counts.
  - Render `Goals` as a source-honest campaign / quest map / trophy shelf, not
    as a duplicate open-task summary.
  - Merge Timeline, Threads, Automations, Reports, PM chat / steer traces, and
    telemetry drill-down into `Pulse`.
  - Merge Evals/QA, Guard, Hardcases, harness tasks, reviews, and missing-proof
    warnings into `Proof`.
  - Merge Files/Docs into `Memory`.
  - Move manifest, harness, bindings, skills, runtime adapter, team mapping, and
    business config into `Config`.
  - Preserve existing deep links to Skill OS, Eval OS, Harness OS, telemetry,
    thread lineage, and ledger/account tooling where useful.
  - Add loading, empty, partial-source, unavailable-source, error, stale, and
    max-content states for each new composed tab.
- `Out:`
  - No new dynamic module loader.
  - No new global module registry work unless required for deep links.
  - No mutation of eval artifacts, skill manifests, Farplane manifests, or
    automation state from this first pass.
  - No public/export hardcase behavior.
  - No auto-repair or enforcement behavior for Guard/Proof.
  - No claim that weekly goal progress is complete unless the evidence map proves
    its sources.

## Functional UI Plan

### Users + Stories
- `Founder-operator:` opens a team table and needs to know whether autonomous
  work is moving this week, where intervention is needed, and what evidence
  exists.
- `Project PM thread / automation operator:` needs pulse decisions, spawned
  work, reports, and config visible without hunting through `.farplane/`.
- `Future implementer:` needs a clear tab contract with data sources and states,
  not a vague "make the panel cleaner" request.

### Current UI Diagnosis
- `Primary action:` decide what to inspect or steer next for this team.
- `Current failure:` the current panel exposes artifact categories as peer tabs:
  Overview, Kanban, Memory, Timeline, Threads, Usage, Goals, Files/Docs, Skills,
  Evals/QA, Automations, Guard, Hardcases, and Ledger.
- `State gaps:` several intelligence tabs are proxy shells or source-unavailable
  placeholders; weekly progress and goal health do not yet have one canonical
  data model.
- `Information hierarchy:` current work, usage, blockers, and next action should
  be first. Audit surfaces should remain available, but not as one tab per file
  type.
- `Interaction cost:` the user must scan too many tabs to answer one question:
  "what happened, why, and can I trust it?"

The redesign should make autonomous team progress obvious by grouping tabs
around operator jobs instead of storage categories.

### Comparable Apps / Patterns
- `Linear / GitHub Projects:` board-first work tracking wins when status is the
  primary decision; details and proof should drill down from the work item.
- `Datadog / Grafana:` overview dashboards should summarize health, usage, and
  freshness while linking to deeper diagnostics.
- `Airflow / Temporal:` run history and schedule state belong together in an
  operations/pulse view with clear success, failure, stale, and retry states.
- `Local Farplane modules:` Skill OS, Eval OS, Harness OS, and Telemetry already
  own global detail views; Team Panel should show scoped summaries and deep
  links, not duplicate full global tools.

### Recommendation
Use a seven-tab model:

```text
[ Overview ] [ Kanban ] [ Goals ] [ Pulse ] [ Proof ] [ Memory ] [ Config ]
```

`Overview` stays because it is the landing promise: "where is this team and is
it healthy?" Usage belongs there as a summary card, with detailed telemetry in
`Pulse`.

## ASCII Wireframes

### Overview
```text
+--------------------------------------------------------------------------------+
| Product Team                                      active | Codex | project path |
+--------------------------------------------------------------------------------+
| [Overview] [Kanban] [Goals] [Pulse] [Proof] [Memory] [Config]                  |
+--------------------------------------------------------------------------------+
| Goal: Ship reliable team cockpit        Week: Jun 22-28       Fresh: 12m ago    |
| Next action: Review blocked TASK-0042   Health: Attention     Source: Convex +  |
|                                                                    sidecar      |
+----------------+----------------+----------------+----------------+------------+
| Open work  18  | Done this wk 4 | Blocked 2      | Review 3       | AI burn $7 |
| +3 since Mon   | from board log | needs operator | proof waiting  | partial    |
+----------------+----------------+----------------+----------------+------------+
| Team roster / presence                                                        |
| + Agent           Role         Live status        Current task        Actions  |
| | PM              planner      spawned child      TASK-0042           chat >   |
| | Builder         worker       implementing       TASK-0038           open >   |
| | QA              reviewer     idle               no assigned work    assign > |
+------------------------------------------------------------------------------+
| Usage summary                 | Recent pulse summary                           |
| tokens/cost/session freshness | last heartbeat, selected action, expected files |
+--------------------------------------------------------------------------------+
```

### Kanban
```text
+--------------------------------------------------------------------------------+
| Weekly goal strip: Ship cockpit proof | Progress: 4 done / 18 open / 2 blocked |
| Filters: owner v | priority v | stale v | proof v       Add task +             |
+--------------------------------------------------------------------------------+
| Todo             | In Progress       | Review           | Blocked     | Done    |
| +--------------+ | +---------------+ | +--------------+ | +---------+ | +----+ |
| | TASK-0041    | | | TASK-0038     | | | TASK-0035    | | | T-0042 | | | .. | |
| | no owner     | | | Builder       | | | needs proof  | | | reason  | | |    | |
| +--------------+ | +---------------+ | +--------------+ | +---------+ | +----+ |
| + quick add     | + quick add        | + quick add       | + add note  |        |
+--------------------------------------------------------------------------------+
| Selected task drawer: summary | owner | linked session | proof | pulse links    |
+--------------------------------------------------------------------------------+
```

### Goals
```text
+--------------------------------------------------------------------------------+
| Goal Campaign                          Scope: Product Team     Source health    |
+--------------------------------------------------------------------------------+
| Active quest                                                               >    |
| Ship reliable team cockpit with weekly autonomous progress visibility          |
+--------------------------+--------------------------+--------------------------+
| Campaign map             | Side objectives          | Trophy shelf             |
| - reduce tab clutter     | - source-honest cockpit  | - goal source unresolved |
| - prove Kanban + usage   | - PM reports visible     | - completed proof-backed |
+--------------------------+--------------------------+--------------------------+
| Linked work                                                                    |
| TASK-0011  Team cockpit redesign              planning       owner: Codex       |
| TASK-0007  Skill/Eval/Harness hierarchy       done           evidence ready     |
+--------------------------------------------------------------------------------+
| Goal packets / delegation                                                      |
| active packet: none | managed teams: unclaimed state shown when mapping fails   |
+--------------------------------------------------------------------------------+
```

### Goals Prototype Notes
- `Quest map:` render current objective as the active quest, with adjacent nodes
  for kickoff, proof gate, blocked checkpoint, and trophy archive.
- `Active quest card:` show goal text, task-backed progress, open/blocked/review
  counts, and source badges. Do not invent weekly deltas.
- `Side objectives:` derive from active tasks and KPIs. Empty state names the
  missing task/KPI source.
- `Trophy shelf:` render completed task/proof trophies and keep completed goals
  visible when the future completed-goal model exists. For this slice, completed
  tasks are explicitly labeled as task-backed trophies, not archived goals.
- `Future planning:` plan the earliest chunk in detail, show future nodes as
  locked/unknown rather than pretending the whole campaign has a validated path.

### Pulse
```text
+--------------------------------------------------------------------------------+
| Pulse / Steer / Reports                         Heartbeat: every 30m | partial |
+--------------------------------------------------------------------------------+
| Latest heartbeat                                                               |
| action: ticket_execution | mode: explore | open tickets: 125 | dry-run: true    |
+-------------------------------+-----------------------------------------------+
| Decisions                     | Spawned threads / PM chat                     |
| hb-2026-06-19 ticket_exec     | [preview] ticket execution 2026-06-19 18:01   |
| hb-2026-06-19 ticket_exec     | automation thread: 019ef4a0...               |
+-------------------------------+-----------------------------------------------+
| Reports                                                                       |
| strategy/latest.md        missing or stale      open >                         |
| ticket-update/latest.md   missing or stale      open >                         |
| memory/latest.md          missing or stale      open >                         |
+--------------------------------------------------------------------------------+
| Live activity / telemetry drill-down                                           |
| Convex feed or fallback rows | unmatched rows | source unavailable states       |
+--------------------------------------------------------------------------------+
```

### Proof
```text
+--------------------------------------------------------------------------------+
| Proof                                                                          |
| Passing 4 | Failing 1 | Missing proof 3 | Hardcase candidates 2 | stale: yes   |
+--------------------------------------------------------------------------------+
| Eval / QA runs                                                                 |
| skill-smoke-mock-clean   pass rate 80%    A:2 B:2 D:1       open run >         |
+--------------------------------------------------------------------------------+
| Proof queue                                                                    |
| TASK-0035  review waiting     no screenshot       owner: QA       open >        |
| TASK-0042  blocked            evidence gap        owner: PM       open >        |
+--------------------------------------------------------------------------------+
| Hardcase candidates / Guard findings                                           |
| source: eval failure + TROUBLES.md + blocked tasks                             |
| export: disabled until redaction, consent, licensing, and provenance exist      |
+--------------------------------------------------------------------------------+
```

### Memory
```text
+--------------------------------------------------------------------------------+
| Memory / Docs                                                                  |
| Search ________  Type: all v  Freshness: any v  Source: project files          |
+------------------------------+-------------------------------------------------+
| Files                        | Preview                                         |
| README.md                    | # Project Goals                                 |
| farplane/goals.md            | Make Farplane UI the reliable local office...   |
| docs/MEMORY.md               | ...                                             |
| docs/HISTORY.md              | ...                                             |
| docs/TROUBLES.md             | ...                                             |
| tickets/TASK-0011/ticket.md  | ...                                             |
+------------------------------+-------------------------------------------------+
| Decision/history anchors: event -> decision -> ticket -> evidence              |
+--------------------------------------------------------------------------------+
```

### Config
```text
+--------------------------------------------------------------------------------+
| Config                                                                         |
| Project: Farplane UI | team id: team-farplane-ui | adapter: codex | partial    |
+------------------------------+-------------------------------------------------+
| Manifest                     | Runtime wiring                                  |
| farplane/manifest.json       | pm.json automation threads: 1                   |
| tracked: 25                  | Convex board: enabled/disabled                 |
| ignored: reports, eval runs  | OpenClaw: optional adapter                     |
+------------------------------+-------------------------------------------------+
| Harness / automations        | Skills / business config                       |
| cadence: 30m heartbeat       | equipped skills summary                         |
| reports paths listed         | local/repo/global skill counts                  |
| gates: no push/deploy/spend  | business ledger enabled? yes/no                 |
+--------------------------------------------------------------------------------+
| Deep links: Skill OS >  Eval OS >  Harness OS >  Telemetry >  Ledger >         |
+--------------------------------------------------------------------------------+
```

## Interaction Rules
- Default to `Overview` when opening a team table.
- Keep `Kanban` one click away and make it the primary editable work surface.
- Show source/freshness badges on every summary card that mixes data sources.
- Use empty states that name the missing source: `Convex disabled`,
  `memory files missing`, `automation state unavailable`, `eval runs missing`.
- Keep global tools as deep links from scoped summaries instead of embedding
  full Skill OS / Eval OS / Harness OS into the Team Panel.
- Preserve auditability by linking every summary to a drill-down tab or source
  file.
- Hardcases are read-only candidates until policy exists.
- Config may display manifest and settings, but should not edit them in this
  first pass.

## Source / Evidence Map
```text
Overview.usage:
  canonical: runtime session usage summaries
  fallback: unavailable/partial badge
  drill_down: Pulse telemetry section

Kanban.weekly_progress:
  canonical: Convex board/activity timestamps
  fallback: sidecar task snapshot without weekly delta claim
  drill_down: Kanban task detail + Pulse activity

Goals.current_objective:
  canonical: project goal / farplane goals / active ticket links
  fallback: "goal source missing"
  drill_down: Goals linked work + Memory source file

Pulse.reports:
  canonical: farplane/automations.md report paths + .farplane reports
  fallback: missing/stale state
  drill_down: report file preview

Proof.eval_health:
  canonical: .farplane/evals/runs index and summaries
  fallback: task/proof proxy with explicit proxy badge
  drill_down: Eval OS

Memory.docs:
  canonical: /farplane/memory-files project bridge
  fallback: empty project path / load error
  drill_down: source file preview

Config.manifest:
  canonical: farplane/manifest.json + farplane/*.md
  fallback: missing manifest warning
  drill_down: raw file preview
```

## Options Appendix
1. `Conservative collapse:` keep Overview, Kanban, Timeline, Memory, Goals,
   Proof, Config, and Usage. Lower change risk, but still too many tabs.
2. `Recommended cockpit:` the seven-tab model in this ticket. Keeps Overview and
   Kanban, folds weak artifact tabs into operator jobs, and preserves deep links.
3. `Goal-first cockpit:` open directly to Goals. Better for strategy, worse for
   the user's stated need that Kanban is the most important operational surface.

## Implementation Handoff
- `Recommended model:` seven-tab autonomous cockpit.
- `Why it wins:` the operator can read team health, usage, weekly progress,
  current work, pulse/report state, proof, memory, and config without treating
  every artifact type as a peer destination.
- `Screens/components:`
  - `TeamPanel` tab shell.
  - `OverviewTab` upgraded with usage summary and source/freshness badges.
  - `KanbanTab` upgraded with weekly goal strip and proof/pulse task links.
  - First Goal-backed prototype: `Goals` campaign map, side objectives, and
    trophy shelf.
  - Later new or refactored tab components: `Pulse`, `Proof`, `Memory`,
    `Config`.
  - Small module-local derived helpers for source/freshness/summary state.
- `States:`
  - default, loading, empty, partial-source, source-unavailable, error, stale,
    max-content, read-only Convex-disabled, and project-mapping-unclaimed.
- `Controls:`
  - tabs, filters, source badges, open-source/deep-link buttons, task drawer,
    report/file preview selectors.
- `Data/content ranges:`
  - min: no Convex, no memory files, no eval runs, no automation reports.
  - typical: 3-8 agents, 10-40 tasks, 3-10 memory files, 0-5 eval runs, 0-20
    pulse/report rows.
  - max: 20+ agents, 100+ tasks, many reports; must preserve scroll and avoid
    full recursive workspace loads on panel open.
- `Implementation notes:`
  - Keep work inside `ui/src/modules/team-workspace`.
  - Keep `team-panel.tsx` as shell only; put heavy derivation in focused hooks
    or helpers.
  - Use existing Convex board/activity paths, `/farplane/memory-files`,
    `/farplane/evals/*`, `/openclaw/skills/catalog`, and existing runtime
    adapter methods before adding new endpoints.
  - Do not duplicate global Skill OS, Eval OS, Harness OS, or Telemetry logic.
- `Visual-design handoff:`
  - Dense operational dashboard, not landing-page composition.
  - Preserve scan path: health and next action first, board second, audit links
    always visible.

## Done / Proof

```text
done_when:
  - Team Panel top-level tabs are Overview, Kanban, Goals, Pulse, Proof, Memory, and Config.
  - Overview includes usage / AI burn with partial-source and unavailable-source states.
  - Kanban includes weekly goal strip without making unsupported progress claims.
  - Timeline, Threads, Automations, Reports, PM steer/chat traces, and Usage drill-down are composed under Pulse.
  - Evals/QA, Guard, Hardcases, harness tasks, reviews, and missing-proof warnings are composed under Proof.
  - Memory includes docs/file browsing for project memory sources.
  - Config shows manifest/harness/automation/PM/runtime/team wiring summaries and deep links.
  - Standalone Ledger, Timeline, Threads, Usage, Files/Docs, Skills, Evals/QA, Automations, Guard, and Hardcases tabs are removed or hidden from the primary tab row.
  - Existing Kanban task editing and Team Panel open/close behavior are preserved.
  - Empty, loading, partial, unavailable, stale, and error states are visible for each composed tab.

proof:
  checks:
    - npm run test:once -- team-panel
    - npm run ui:build
    - git diff --check -- ui/src/modules/team-workspace
  manual:
    - browser QA for /office opening a team panel at desktop and mobile widths
    - screenshot each tab: Overview, Kanban, Goals, Pulse, Proof, Memory, Config
    - verify no horizontal overflow in the panel tab row or tab content
    - verify source/unavailable badges render when Convex, memory, eval, or automation data is missing
  review:
    - rubric: functional UI matches this ticket, data source boundaries are honest, current Kanban behavior is preserved, and global tools are deep-linked rather than duplicated
      required_tas: visual-qa or human review before closeout
  evidence:
    - screenshots or QA artifact paths summarized in ticket progress
    - command outputs summarized in final response
```

## State
- `next_action:` Kenji Review seven-tab cockpit prototype and decide
  polish/data adapter follow-ups.
- `blocked:` false
- `latest_verification:` TASK-0011 admission review passed on 2026-06-25.
  `npm run test:once -- team-panel`, `npm run ui:build`,
  `git diff --check -- ui/src/modules/team-workspace tickets/TASK-0011`, and
  fresh Playwright browser proof for `/office` Team Workspace passed. Browser QA
  confirmed the primary tab row is exactly `Overview`, `Kanban`, `Goals`,
  `Pulse`, `Proof`, `Memory`, `Config`; confirmed inline secondary branches for
  `Pulse`, `Proof`, `Memory`, and `Config`; and confirmed no document-level
  horizontal overflow at desktop `1440x1000` or mobile `390x844`.
  Browser console still showed local backend `502` responses and headless WebGL
  context errors unrelated to this component slice.
- `review_verdict:` ready for Kenji Review.
- `result:` seven-tab autonomous cockpit prototype implemented and evidence
  reconciled.

## Links
- `program:` `tickets/TASK-0011/program.md`
- `progress:` `tickets/TASK-0011/progress.md`
- `artifacts:` `.farplane/proof/TASK-0011-goals-campaign-tab.png`,
  `.farplane/proof/TASK-0011-panel-goals.png`,
  `.farplane/proof/TASK-0011-panel-pulse.png`,
  `.farplane/proof/TASK-0011-panel-proof.png`,
  `.farplane/proof/TASK-0011-panel-memory.png`,
  `.farplane/proof/TASK-0011-panel-config.png`,
  `.farplane/proof/TASK-0011-desktop-overview.png`,
  `.farplane/proof/TASK-0011-desktop-kanban.png`,
  `.farplane/proof/TASK-0011-mobile-overview.png`,
  `.farplane/proof/TASK-0011-mobile-kanban.png`
- `review:` `tickets/TASK-0011/artifacts/review-evidence-2026-06-25.md`
- `refs:` `ui/src/modules/team-workspace/`, `docs/features/FEAT-0001-operator-intelligence-modules-roadmap.md`, `farplane/manifest.json`, `farplane/automations.md`, `.farplane/evals/runs/`, `.farplane/automation/`
