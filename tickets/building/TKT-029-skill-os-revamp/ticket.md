---
id: TKT-029
title: Skill OS revamp into graph-first mini app
state: review
owner: Farplane UI
assignee: Codex
created_at: 2026-06-14
complexity: M
supersedes: TKT-023 Skill OS surface shape
---

# TKT-029: Skill OS Revamp Into Graph-First Mini App

## Status

- state: `review`
- owner: Farplane UI
- assignee: Codex
- dependencies: existing `skill-maintenance/graph` viewer and data files
- location: `tickets/building/TKT-029-skill-os-revamp`
- enter when: operator rejected the tabbed Skill OS panel as the wrong mental model
- leave when: global `Skill OS` opens a graph-first mini app that preserves the
  Skill Maintenance graph experience inside Farplane chrome
- blockers: none known
- spawned follow-ups: none yet
- complexity: `M`

## User Correction

The current Skill OS is too much of a generic Farplane tab panel. The desired
surface is the Skill Maintenance graph viewer adapted into Farplane, not a
small graph squeezed into the existing Skills panel.

Use the existing Skill Maintenance graph as the product reference:

- `/Users/kenjipcx/.codex/skills/skill-maintenance/graph/index.html`
- `/Users/kenjipcx/.codex/skills/skill-maintenance/graph/skill-graph.json`
- `/Users/kenjipcx/.codex/skills/skill-maintenance/graph/skill-docs.json`

## Goal

Make `Skill OS` a standalone graph-first mini app where the graph is the primary
entrypoint. A skill list/sidebar is secondary and should drive graph focus.
Clicking a graph node should select the same skill in the sidebar and open a
skill detail surface over the graph, not below it. Clicking a sidebar skill
should pan/focus/highlight the matching graph node.

## Non-Goals

- Do not mix `Evals` or `Harness` into the Skill OS UI.
- Do not make Overview/Graph/Files/Diagram/Demos/Controls tabs the primary
  Skill OS structure.
- Do not replace the graph with a black-and-white ring preview.
- Do not show harness-wide docs/files/agents in the Skill OS graph.
- Do not put selected skill details below the graph where they push the graph
  out of view.

## OSK: Operating Sketch

```text
GLOBAL RADIO DIAL
  Skill OS
    opens standalone graph mini app

+--------------------------------------------------------------------------------+
| Skill OS                                                         [search] [x]   |
| Skill Maintenance graph viewer adapted to Farplane chrome                       |
|                                                                                |
|  +----------------------+  +------------------------------------------------+  |
|  | Skill Sidebar        |  | Skill Call Graph as primary canvas            |  |
|  |----------------------|  |------------------------------------------------|  |
|  | search/filter        |  | colored tier nodes                             |  |
|  | tier/source filters  |  | Markdown-ref edges                             |  |
|  |                      |  | dashed common-chain edges                       |  |
|  | advise               |  | zoom / pan / fit controls                       |  |
|  | agent-browser        |  | selected node highlighted                       |  |
|  | skill-maintenance <- |  |                                                |  |
|  | eval                 |  |       advise ----> reference-grounding          |  |
|  | qa                   |  |          \\             ^                        |  |
|  | review               |  |           \\            |                        |  |
|  |                      |  |        skill-maintenance ----> eval             |  |
|  +----------------------+  |                                                |  |
|                            |   +---------- Skill Detail Overlay ---------+  |  |
|                            |   | skill-maintenance                       |  |  |
|                            |   | frontmatter chips / outgoing links      |  |  |
|                            |   | rendered SKILL.md / special files       |  |  |
|                            |   | [Open full page] [Close]                |  |  |
|                            |   +-----------------------------------------+  |  |
|                            +------------------------------------------------+  |
+--------------------------------------------------------------------------------+
```

## Detail Mode Options

Recommended first pass: overlay detail modal on top of the graph.

- Option A: `graph + floating detail modal`
  - keeps graph visible as the spatial context
  - matches the current Skill Maintenance viewer direction
  - fastest to implement and easiest to screenshot
- Option B: `graph -> skill full-page drill-in`
  - better for long reading/editing sessions
  - can become a route/state inside the mini app, e.g.
    `Skill OS / skill-maintenance`
  - should be available from the overlay as `Open full page`
- Decision: implement Option A first, include an `Open full page` affordance or
  route placeholder so Option B can follow without redesigning the graph.

## Interaction Contract

- `sidebar.select(skillId) -> graph.focus(skillId) + detail.overlay(skillId)`
- `graph.nodeClick(skillId) -> sidebar.select(skillId) + detail.overlay(skillId)`
- `detail.openFullPage(skillId) -> miniApp.mode("skill-detail-page", skillId)`
- `graph.edgeClick(edgeId) -> detail.showEdge(source, target, edgeType)` if
  cheap; otherwise defer edge detail to a later ticket
- `search(query) -> filters sidebar + dims nonmatching graph nodes`
- `fitGraph() -> centers visible graph`
- `collapseSidebar() -> graph becomes full-width`
- `closeDetail() -> graph remains focused, detail overlay closes`

## Data Contract

- Source graph data: `skill-graph.json`
- Source skill docs: `skill-docs.json`
- Edges:
  - `markdown-ref`: draw solid edge
  - `common-chain`: draw dashed edge
- Nodes:
  - preserve tier/source colors from the Skill Maintenance viewer
  - selected node has a strong highlight ring
  - hovered node highlights incoming/outgoing edges

## Acceptance Criteria

- [x] AC-1: `Skill OS` global launcher opens a standalone graph-first mini app.
- [x] AC-2: The graph visually resembles the Skill Maintenance viewer: colored
  nodes, visible edges, tier/source styling, and readable controls.
- [x] AC-3: No top-level `Evals` or `Harness` tabs appear inside Skill OS.
- [x] AC-4: No old `Overview/Graph/Files/Diagram/Demos/Controls` tab strip is
  used as the primary Skill OS structure.
- [x] AC-5: Sidebar skill click focuses/highlights the matching graph node and
  opens skill detail as an overlay on the graph.
- [x] AC-6: Graph node click selects the matching sidebar row and opens skill
  detail as an overlay on the graph.
- [x] AC-7: Skill detail renders parsed frontmatter, rendered `SKILL.md`, and
  outgoing links from `skill-docs.json`.
- [x] AC-8: Skill detail includes an `Open full page` affordance or route
  placeholder for a full-page skill reading mode.
- [x] AC-9: Skill OS graph uses only skill-to-skill edges from `skill-graph.json`.
- [x] AC-10: Browser screenshots prove default graph, sidebar-to-node focus,
  node-to-overlay selection, and no Evals/Harness tabs in Skill OS.

## QA Evidence

- report:
  `tickets/building/TKT-029-skill-os-revamp/artifacts/qa-2026-06-14-skill-os-revamp/qa-report.md`
- screenshots:
  - `skill-os-default-graph.png`
  - `skill-os-sidebar-focus-overlay.png`
  - `skill-os-node-click-overlay.png`
  - `skill-os-full-page-affordance.png`
- data proof:
  - `endpoint-snapshot.json`
  - `qa-assertions.json`
  - `browser-console.log` includes an existing headless WebGL renderer error;
    Skill OS DOM assertions and screenshots still passed

## Follow-up QA Evidence

- report:
  `tickets/building/TKT-029-skill-os-revamp/artifacts/qa-2026-06-14-skill-os-d3-pan/qa-report.md`
- screenshots:
  - `skill-os-d3-default.png`
  - `skill-os-d3-panned.png`
  - `skill-os-d3-zoomed.png`
  - `skill-os-sidebar-wrapped-overlay.png`
- proof:
  - D3 zoom transform changes after drag pan and wheel zoom.
  - Sidebar card content wraps instead of clipping.
  - Skill detail overlay still opens from sidebar selection.

## Reagraph Spike Evidence

- report:
  `tickets/building/TKT-029-skill-os-revamp/artifacts/qa-2026-06-14-skill-os-reagraph/qa-report.md`
- screenshots:
  - `skill-os-reagraph-default.png`
  - `skill-os-reagraph-sidebar-overlay.png`
  - `skill-os-reagraph-guarded-webgl-flags.png`
- proof:
  - Reagraph installed and wired as preferred renderer.
  - Headless and blank-canvas guardrails prevent a blank graph from remaining
    visible.
  - D3/SVG fallback remains available and user-visible.
  - Vite aliases/dedupes Three-related packages for fewer duplicate runtime
    risks.

## Implementation Notes

- Prefer lift-and-shift from `skill-maintenance/graph/index.html` first, then
  adapt styling to Farplane dark panel tokens.
- The fastest acceptable pass can mount a dedicated Skill OS component that
  ports the old viewer logic into React.
- Avoid stalling on perfect graph architecture. Preserve the old behavior first:
  real graph, real links, real detail panel.
- If using a shared graph renderer later, treat it as a follow-up after the old
  Skill Maintenance graph behavior is visible and proven.

## Proof Plan

- Screenshot: default Skill OS graph-first mini app.
- Screenshot: sidebar selects `skill-maintenance`, graph highlights it, and
  detail appears as an overlay.
- Screenshot: graph node click opens skill detail overlay.
- Screenshot or DOM assertion: detail overlay exposes `Open full page`.
- Screenshot: Skill OS with no `Evals` / `Harness` / legacy tab strip.
- Endpoint snapshot: `skill-graph.json` and `skill-docs.json` counts.
- Browser console log: no meaningful errors in the proof run.
