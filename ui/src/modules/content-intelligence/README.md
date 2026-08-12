---
kind: module-guide
status: active
project: Farplane UI
created_at: 2026-08-13
updated_at: 2026-08-13
owner: content-platform
source_of_truth: ../../../../docs/features/FEAT-0117-video-intelligence.md
---

# Content Intelligence Module

This module is the read-only Office surface for every external source already
in Farplane. Its four primary tabs are **Content**, **News**, **Concepts**, and
**World**; Video Intelligence is the YouTube-analysis capability visible within
this surface, not a second public panel.

The [feature contract](../../../../docs/features/FEAT-0117-video-intelligence.md)
owns product semantics. The [content system](../../../../docs/systems/content-capture-and-analysis.md)
owns source/job boundaries. This guide owns the UI composition and maintenance
seams.

## Composition

```text
OfficeSimulation
  -> ContentIntelligenceDataController (retained read lifecycle)
  -> ContentIntelligencePanel
  -> OfficeWorkspaceDialog (viewport/focus/frame)
  -> one tab body scroll region
```

`ContentIntelligenceDataController` activates its Convex subscriptions on the
first visit and keeps them mounted while the dialog closes. The panel owns tabs,
detail routing, and Back context. The shared dialog owns only the common frame;
see the [dialog contract](../../components/office-workspace-dialog.md).

## Chronological feed contract

Content and News use **end-of-feed automatic pagination**, not a pull-to-refresh
gesture and not a date-picker workflow.

```ts
loadOlder(dayStatus, olderDay) -> load current day page | append older day | done
```

1. Read the newest available server calendar day.
2. When the user reaches the end sentinel, page more items for that day.
3. When that day is exhausted, request the next older populated day and append
   it after the existing groups.
4. When a live subscription refreshes an already loaded day, replace that group
   by ID instead of duplicating it.

Date dividers remain ordinary in-flow headings—never sticky overlays. Stored
`YYYY-MM-DD` values and ISO timestamps render as the original UTC day so a
browser timezone cannot move a card across a visible day boundary. The
`TimelineEndSentinel` observes the one tab body scroll root with a 180px bottom
margin; there are no older/newer-day controls.

## Ownership map

- `components/content-intelligence-data-controller.tsx`: warm subscription
  lifetime and runtime bundle.
- `components/content-intelligence-panel.tsx`: shared-panel composition and
  tab/detail state.
- `components/content-intelligence-library.tsx`: Content/News/Concepts bodies
  and their one-scroll chronological feed.
- `components/content-intelligence-dossier.tsx`: dossier, Story, and source
  detail bodies.
- `components/content-intelligence-view-primitives.tsx`: date rendering,
  terminal state, and the shared end sentinel.
- `hooks/use-content-intelligence-timeline.ts`: Content date feed.
- `hooks/use-editorial-intelligence.ts`: News date feed, filters, and related
  coverage reads.
- `lib/timeline-feed.ts`: pure day-page replacement/append behavior.

## Proof

Run the focused timeline/model tests, then open **Content Intelligence** from
the Office command palette. Confirm a date divider sits above—not over—its
cards, scroll to append an older populated day, and verify no date-navigation
buttons appear. Also prove a dossier opens immediately and Back restores its
library context. The fuller path lives in
[the module QA runbook](docs/qa-runbook.md).
