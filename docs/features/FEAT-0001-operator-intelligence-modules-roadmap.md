# FP01: Operator Intelligence Modules Roadmap

**Status**: Draft
**Created**: 2026-06-13
**Owner**: Farplane UI
**Source idea**: Bring the remaining Aikage/Farplane operating intelligence surfaces into Farplane UI as first-party shadcn-style modules.

## Purpose

Farplane UI should make the operator's real AI operating system visible: skills,
standards, rollouts, QA, evals, lessons, automations, hardcases, goals, and
health signals. Most source data already exists in skills, hooks, markdown
memory files, tickets, local automation state, and runtime telemetry; the
missing work is coherent product rendering and module ownership.

This roadmap defines the next module family after telemetry. It starts the
Farplane `FP` convention for new product doctrine; legacy `SC*` specs remain as
historical source material, but new specs should use `FP`.

## Product Principle

Every module should have a global view and, when useful, a project/team scoped
view. The global view is accessed through the global radio dial / launcher. The
team-scoped view is accessed through the team table's Team Panel.

```ts
module_view(scope) -> global_dashboard | team_or_project_panel
```

- Global view: portfolio rollups, cross-project comparison, inventory, and
  operator-level decisions.
- Team/project view: the primary autonomous operating cockpit for that team,
  including local goals, local evidence, local rollouts, local files, local
  memory, and local next actions.
- Office entry: modules appear in the global launcher, command palette, and
  optional office object bindings. Scoped entry starts from the team table /
  Team Panel; future furniture can deep-link to the same tabs, but should not
  become a separate ownership model.
- Standard entry: modules appear as navigation-first dashboard panels once the
  standard renderer registry is stable.

## What Is Left Unclear

- **Data ownership for automation state**: local Codex app automations may be
  accessible through tool state rather than repo files. The first UI should
  render available local state and include an explicit "source unavailable"
  state.
- **Hardcase commercialization boundary**: hardcases can be shown as datasets,
  but selling/exporting data needs explicit redaction, consent, licensing, and
  provenance policy before any public marketplace behavior.
- **Mighty Guard authority**: its exact job is still fuzzy. First slice should
  be advisory health findings only, not automatic repair or enforcement.
- **Goals source of truth**: goals exist across tickets, native Goal packets,
  project KPIs, org chart teams, and memory docs. The first portfolio should
  show links and health, not attempt to rewrite every goal system.
- **Skill standard schema**: skills already have `SKILL.md`, frontmatter,
  lock/registry state, tests, and maintenance guidance, but the UI needs a small
  normalized view model before deep editing.
- **Team scope mapping**: use existing `team-${projectId}` and active project
  tracking-context conventions. Unmapped directories should render as
  "unclaimed" instead of disappearing.

## Team Goal Delegation Model

Farplane teams map to project directories. Higher-level manager projects such
as Zanarkand Technologies can see the goals, active projects, KPIs, blockers,
and phase targets for the teams they manage. The UI should express that as a
manager goal portfolio and delegation view, not as a generic hierarchy browser.

```text
team_table(project_dir)
  -> Team Panel
    -> Goals tab
      -> roadmap
      -> event timeline
      -> active projects + KPIs
      -> current phase / current quarter targets
      -> next phase plan
      -> delegation links to managed team tables
    -> Files / Docs tab
      -> literal project files and docs
      -> markdown rendering
      -> decision/history graph where structure exists
    -> feature tabs scoped to the selected team/project context
```

The CEO / management table follows the same rule as every other table. It has a
Goals tab inside its Team Panel; it is not a separate office object.

## Module Inventory

| Module | Directory | Global View | Team / Project View | Primary Sources |
| --- | --- | --- | --- | --- |
| Telemetry | `ui/src/modules/telemetry` | Existing telemetry dashboard plus light polish | Team runtime pulse and diagnostics | Convex `runtimeTelemetryActivityPings` |
| Skill Standards | `ui/src/modules/skills-studio` | Existing skills graph / skill-maintenance UI adapted to Farplane style | Skills equipped/needed for a team | `skills/`, installed skills, `skills-lock.json`, skill tests |
| Eval Lab | `ui/src/modules/evals` | Existing eval/QA UI adapted to Farplane style | Eval evidence for team skills/goals | eval artifacts, tickets, skill tests |
| Learning Inbox | `ui/src/modules/lessons` or `self-improvement` | Lessons/troubles/history/memory index | Project markdown memory renderer | project `docs/*.md`, hook outputs |
| Automations | `ui/src/modules/automations` | Reminders, monitors, recurring checks | Project/team automation bindings | automation tool state, repo/run artifacts |
| Mighty Guard | `ui/src/modules/mighty-guard` | Advisory health checks once sources are clearer | Team/project risk findings | specs, tickets, skills, evals, logs |
| Hardcases | `ui/src/modules/evals` filter or `ui/src/modules/hardcases` later | Sellable-case filter over eval/QA data | Project hardcase capture and redaction | eval failures, QA reports, lessons/troubles |
| Goals Portfolio | `ui/src/modules/goals` | Cross-team goal rollup and drift | Per-team autonomous goal portfolio | projects, teams, tickets, Goal packets |
| Docs / Files | `ui/src/modules/bookshelf` or existing docs module | Farplane doctrine, specs, runbooks, public docs | Project-dir files, docs, tickets, and memory | `docs/`, `tickets/`, `qa/`, module docs |

## Office And Panel Shape

The office should not create separate furniture for every module in this slice.
The team table is the entrypoint. The global radio dial opens rollups; clicking
a team table opens the Team Panel with feature tabs.

```text
+--------------------------------------------------------------------------------+
| Global Radio Dial                                                              |
| [Telemetry] [Skills] [Evals] [Learning] [Automations] [Guard] [Hardcases]      |
| [Goals Rollup] [Docs]                                                          |
+--------------------------------------------------------------------------------+
| Office Floor                                                                   |
|                                                                                |
|   +----------------------+  +----------------------+  +----------------------+  |
|   | CEO / Management     |  | Product Team         |  | Growth Team          |  |
|   | click -> Team Panel  |  | click -> Team Panel  |  | click -> Team Panel  |  |
|   +----------------------+  +----------------------+  +----------------------+  |
|                                                                                |
+--------------------------------------------------------------------------------+
```

```text
Team Panel: Product Team
+--------------------------------------------------------------------------------+
| Header: team name | project dir | manager | health | next autonomous action    |
+--------------------------------------------------------------------------------+
| Tabs                                                                           |
| [Overview] [Kanban] [Artifacts] [Memory] [Timeline] [Telemetry] [Business]     |
| [Ledger] [Goals] [Files/Docs] [Skills] [Evals/QA] [Automations] [Hardcases]    |
|                                                                                |
| +----------------------------------------------------------------------------+ |
| | selected tab content for this team/project context                         | |
| | evidence, actions, source paths, diagnostics, links to managed teams        | |
| +----------------------------------------------------------------------------+ |
+--------------------------------------------------------------------------------+
```

## Team Panel Tab Sketches

The following sketches describe the scoped version of each module. Global views
reuse the same modules but summarize across teams from the global radio dial.

```text
[Goals]
+--------------------------------------------------------------------------------+
| Team Goal | Autonomy Health | Next Action | Blockers                           |
+--------------------------------------------------------------------------------+
| Roadmap            | Goal Portfolio                                           |
| Event Timeline     | - current objective                                      |
| Active Projects    | - active Goal packets                                    |
| KPIs + Targets     | - current phase / quarter targets                        |
| Next Phase Plan    | - linked tickets and delegation to managed teams          |
|                    | - evidence from telemetry / skills / evals / memory      |
+--------------------------------------------------------------------------------+
```

```text
[Files / Docs]
+--------------------------------------------------------------------------------+
| Search docs/files | Type filter | Freshness | Source path                      |
+--------------------------------------------------------------------------------+
| File Structure     | Document/File Browser                                     |
| README.md          | rendered markdown preview + source path                  |
| docs/              | MEMORY.md | HISTORY.md | LESSONS.md | TROUBLES.md       |
| tickets/           | related tickets / QA / modules                           |
+--------------------------------------------------------------------------------+
```

```text
[Telemetry]
+--------------------------------------------------------------------------------+
| Agent Hours | Completed Turns | Active Starts | Data Health                    |
+--------------------------------------------------------------------------------+
| Existing UI        | Runtime trend + lifecycle diagnostics                     |
| Team scope         | project/team pings, source split, unmatched rows          |
+--------------------------------------------------------------------------------+
```

```text
[Skills]
+--------------------------------------------------------------------------------+
| Equipped | Recommended | Needs QA | Rollout Drift                            |
+--------------------------------------------------------------------------------+
| Existing graph / registry   | skill cards, standards checklist, rollout notes   |
| Team-required skills        | selected skill detail + tests/evidence            |
+--------------------------------------------------------------------------------+
```

```text
[Evals / QA]
+--------------------------------------------------------------------------------+
| Passing | Failing | Missing Proof | Stale Runs                                |
+--------------------------------------------------------------------------------+
| Existing eval/QA UI         | run history, evidence links, hardcase candidates  |
+--------------------------------------------------------------------------------+
```

```text
[Memory / Learning]
+--------------------------------------------------------------------------------+
| Lessons | Troubles | Memory | History | Promotion Queue                         |
+--------------------------------------------------------------------------------+
| Markdown files              | rendered entries + source line / promotion action |
| Decision graph              | event -> decision -> reason -> consequence        |
+--------------------------------------------------------------------------------+
```

```text
[Automations]
+--------------------------------------------------------------------------------+
| Active | Due Soon | Failing | Source Unavailable                           |
+--------------------------------------------------------------------------------+
| recurring checks / monitors | next run, last result, owner, project binding    |
+--------------------------------------------------------------------------------+
```

```text
[Guard]
+--------------------------------------------------------------------------------+
| Critical | Warnings | Missing Proof | Stale Standards                         |
+--------------------------------------------------------------------------------+
| Local harness map           | findings, evidence links, suggested action       |
+--------------------------------------------------------------------------------+
```

```text
[Hardcases]
+--------------------------------------------------------------------------------+
| Cases | Ready | Needs Redaction | Policy Blocked                            |
+--------------------------------------------------------------------------------+
| Eval filter: hardcases      | provenance, reproducibility, sellability gates   |
+--------------------------------------------------------------------------------+
```

## Shared UI Pattern

Each module should follow the same operator rhythm:

```text
Header: scope selector + freshness badge + primary action
Bento: 4-8 cards that answer "what matters right now?"
Main: table/tree/timeline/graph for inspection
Side panel: selected item detail, evidence links, and next action
Diagnostics: raw rows, missing-source states, and QA evidence
```

Avoid building one-off marketing pages. These are operational modules.

## Roadmap

### R1: Telemetry Bento

Keep the existing telemetry UI because it is already close enough. Only add
small dashboard polish where it improves scan speed.

- Preserve the current tab structure and diagnostics.
- Bento cards: agent hours, completed turns, active starts, unmatched lifecycle
  rows, top project, stale telemetry, source coverage, import/live split.
- Do not start a theme panel refresh or second telemetry entrypoint.

### R2: Skill Standards And Rollouts

Lift the existing skills graph / skill-maintenance UI into the Farplane module
style.

- Render skill cards with standard compliance, source location, installed state,
  tests, references, and rollout status.
- Reuse the graph view from the `skill-maintenance` skill where practical.
- Add global registry view and team-scoped equipped/needed skills view.

### R3: Eval Lab And QA Checklists

Lift the existing eval and QA surfaces into Farplane style.

- Render eval suites, recent runs, pass/fail trends, and linked artifacts.
- Show QA checklist state per skill/module/ticket.
- Let team/project view answer: "what proof exists for this team's skills and
  workflow?"

### R4: Learning Inbox And Memory Rendering

Render project docs and memory files as navigable Markdown UI.

- Global learning inbox: cross-project lessons, troubles, history, and memory.
- Team/project memory: polished rendering of `docs/MEMORY.md`,
  `docs/LESSONS.md`, `docs/TROUBLES.md`, and `docs/HISTORY.md`.
- Add a decision/history graph where the file structure supports it.

### R5: Automations

Render automations as first-party operations state.

- Global automation dashboard: reminders, monitors, recurring checks, wakeups.
- Team/project view: relevant automations, next run, last result, owner.
- Include empty/source-unavailable states because automation state may be tool
  backed rather than repo backed.

### R6: Mighty Guard Harness Map

Keep Mighty Guard advisory until the product role is clearer.

- Candidate findings: stale standards, missing QA, broken rollout, unowned
  module, failing eval, outdated memory.
- Prefer a small advisory queue before a graph-heavy control surface.

### R7: Hardcase Data

Show hardcases as a filtered eval/QA view first.

- Inventory hardcases from eval failures, QA gaps, lessons/troubles, and
  manually curated datasets.
- Show value/readiness: domain, reproducibility, redaction state, consent state,
  provenance, suggested buyer/use.
- No public export until redaction/licensing policy exists.

### R8: Goals Portfolio

Give each team table its own goal portfolio designed to help the team run as
autonomously as possible.

- Global view: cross-team rollup, drift, blocked goals, and company-level goal
  comparison from the global radio dial.
- Team/project view: the primary surface. It shows roadmap, active projects,
  KPIs, current phase/quarter targets, event timeline, native Goal packets,
  telemetry, required skills, eval status, memory signals, project files, and
  next autonomous action.
- Team Panel is the entrypoint. Future office furniture can deep-link into
  specific tabs, but the team table remains the canonical scoped cockpit.

### R9: Docs And Farplane Testament

Render Farplane's own doctrine globally, and render each project directory's
files from the Team Panel.

- Global docs library: FP specs, legacy SC specs, architecture, runbooks, QA,
  public docs, module docs, tickets, and memory.
- Team/project Files/Docs tab: literal project files, deep-init memory docs,
  linked tickets, and rendered Markdown.
- Include search, type filters, source path, freshness, owner, and "why this
  matters" metadata.
- This is read-first; editing can remain a follow-up.

## Implementation Rules

- Use shadcn UI primitives and existing module patterns.
- Prefer static first-party modules; no dynamic plugin loader.
- Read real local sources first and render empty/source-missing states instead
  of seeding fake demo data.
- Keep ingestion/parsing local until two modules need the same helper.
- Add small normalizers per module before UI grows complex.
- For browser-visible work, add stable launcher entry and a QA path.

## Ticket Split

- `TKT-013`: Telemetry bento dashboard.
- `TKT-014`: Skill standards, registry, and rollout UI.
- `TKT-015`: Eval Lab and QA checklist surfaces.
- `TKT-016`: Learning inbox and memory renderer.
- `TKT-017`: Automations dashboard.
- `TKT-018`: Mighty Guard harness map.
- `TKT-019`: Hardcase data inventory.
- `TKT-020`: Team goal portfolio and org rollup.
- `TKT-021`: Docs and Farplane testament renderer.

## Non-Goals

- Do not migrate all old Aikage/Sigmax UI wholesale.
- Do not add Convex Auth for these local-first operator modules by default.
- Do not create a `console` module.
- Do not create public hardcase marketplace/export behavior before policy exists.
- Do not make Mighty Guard auto-repair code in the first slice.

## Proof

The roadmap is ready to execute when:

- Each module has a ticket with global/team scope, expected UI shape, source
  files, and proof path.
- The spec index points to this roadmap.
- Tickets can be batched without needing new product discovery per ticket.
