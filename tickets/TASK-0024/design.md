---
artifact_id: TASK-0024-team-panel-functional-ui
artifact_type: design
created_at: 2026-07-01
owner: Farplane UI
source_skill: functional-ui
review_target: Team Panel Overview, Goals, Distribution, and Members tabs should match this information architecture before TASK-0024 is considered visually accepted.
---

# Team Panel Functional UI Contract

## Decision

Use a decision-mode split instead of putting every metric in Overview.

- `Overview`: CEO scan. What matters, what moved, what is missing, and where to drill in.
- `Goals`: KPI cockpit. Goal axis -> SMART goal -> KPI rows with Daily/Cumulative chart modes.
- `Distribution`: social/content workbench. Platform/content performance, links, and content-level gaps.
- `Members`: compact persistent-agent roster. No old profile-card treatment.

## Users + Stories

- CEO/operator: "I need to know if Farplane is moving toward its goals without reading every metric."
- Distribution operator: "I need to inspect which posts/content are working and what data is missing."
- Team operator: "I need to know which persistent agents exist and what they are doing right now."

## Current UI Diagnosis

The existing Overview mixed CEO summary, full KPI analytics, content review, project scope controls, and large member cards. The redesign should make the next executive decision obvious by moving heavy drilldowns into their own tabs and promoting open gaps/report links near the top.

## Comparable Apps

- Executive dashboards: summary-first layout with drilldowns kept nearby, not full analytic detail on the first screen.
- KPI dashboards: goal/target context next to trends so growth is not shown without meaning.
- Social analytics tools: content performance lives in a table/list with platform filters, URLs, and per-item metrics.
- Ops dashboards: rosters are compact presence/status rows, not profile-card galleries.

## Recommended Model

```text
Team Panel
┌──────────────────────────────────────────────────────────────┐
│ Tabs: Overview | Goals | Distribution | Members | ...         │
└──────────────────────────────────────────────────────────────┘
```

### Overview

```text
OVERVIEW
┌──────────────────────────────────────────────────────────────┐
│ Farplane Operating Summary                         2026-07-01 │
│ Can Farplane complete meaningful cycles with less intervention?│
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Open Gaps + Reports                                          │
│ x_retention_score source gap     [Daily report] [Weekly]     │
│ instagram_reel_metrics no recent reel                        │
└──────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Goal Health  │ Today Move   │ Distribution │ Agents       │
│ 3/5 active   │ +207 views   │ 2 posts live │ 4 persistent │
│ 2 gaps       │ +15 improve. │ 1 source gap │ 1 stale      │
└──────────────┴──────────────┴──────────────┴──────────────┘

┌────────────────────────────┬───────────────────────────────┐
│ North Star                 │ Current Bet                   │
│ concise source-backed text │ concise source-backed text     │
└────────────────────────────┴───────────────────────────────┘
```

### Goals

```text
GOALS
┌──────────────────────────────────────────────────────────────┐
│ Distribution From Evidence                                   │
│ Are we proving distribution with real audience signals?       │
│                                              1 SMART goal     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ distribution_q3                                              │
│ Grow owned social reach from real content by 2026-09-30       │
│                                                              │
│ [Daily] [Cumulative]                                         │
├──────────────────────┬────────────────────────────┬──────────┤
│ KPI                  │ 7-day chart                │ Now      │
├──────────────────────┼────────────────────────────┼──────────┤
│ X views              │ ▂ ▃ ▄ ▁ ▁ ▁ █   Today +207 │ 207      │
│ X likes              │ ▁ ▁ ▁ ▁ ▁ ▁ ▁   Today +0   │ 0        │
│ Instagram views      │ ▁ ▁ ▁ ▂ ▅ ▁ █   Today +2180│ 2180     │
│ X retention score    │ source gap                 │ missing  │
└──────────────────────┴────────────────────────────┴──────────┘
```

### Distribution

```text
DISTRIBUTION
┌──────────────────────────────────────────────────────────────┐
│ 7-day Distribution Summary                                   │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Views        │ Engagements  │ Content      │ Gaps           │
│ 2,387        │ 131          │ 2 selected   │ 1 retention    │
└──────────────┴──────────────┴──────────────┴────────────────┘

Filters
┌────────────┬────────────┬────────────┬────────────┐
│ All        │ X          │ Instagram  │ Gaps only  │
└────────────┴────────────┴────────────┴────────────┘

Content Performance
┌───────────┬──────────┬────────────┬───────┬───────┬──────┬──────┬───────────┬──────┐
│ Platform  │ Kind     │ Published  │ Views │ Likes │ Com. │ Sh/S │ Retention │ Open │
├───────────┼──────────┼────────────┼───────┼───────┼──────┼──────┼───────────┼──────┤
│ X         │ post     │ Jun 30     │ 207   │ 0     │ 2    │ 0    │ gap       │ ↗    │
│ Instagram │ carousel │ Jun 30     │ 2180  │ 130   │ 0    │ 1/0  │ n/a       │ ↗    │
└───────────┴──────────┴────────────┴───────┴───────┴──────┴──────┴───────────┴──────┘
```

### Members

```text
MEMBERS
┌──────────────────────────────────────────────────────────────┐
│ Persistent Agents                                 4 total     │
├──────────────────────┬──────────────┬──────────────┬────────┤
│ Agent                │ State        │ Current Work │ Updated│
├──────────────────────┼──────────────┼──────────────┼────────┤
│ Codex PM             │ active       │ triage       │ 2m ago │
│ Pulse Executor       │ idle         │ waiting      │ 8m ago │
│ Review Agent         │ stale        │ review queue │ 1h ago │
└──────────────────────┴──────────────┴──────────────┴────────┘
```

## Review Checklist

- Overview shows open gaps and Daily/Weekly report affordances before lower-priority summary content.
- Overview does not render the full KPI cockpit or full content insights list.
- Goals owns the full KPI cockpit grouped by goal axis and SMART goal.
- Distribution owns content/social insight review and per-item open links.
- Members shows compact persistent-agent rows and no old profile image previews.
- All missing data is source-labeled as a gap or unavailable state, not zero.
