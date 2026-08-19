---
kind: qa-runbook
status: active
project: Farplane UI
created_at: 2026-08-13
updated_at: 2026-08-19
owner: content-platform
feature_refs:
  - FEAT-0117
---

# Content Intelligence QA Runbook

Use a configured Convex development deployment with Content records on at
least two observed dates. If the current day has fewer than the page size,
ensure an older populated day exists; do not manufacture a product record only
to make a browser assertion pass.

1. Open `/office`, then use the command palette's **Content Intelligence**
   action. Confirm the primary tabs are Content, News, Concepts, and World.
2. In Content, inspect the first date divider and its cards. An exact stored
   ISO date must render as its own `YYYY-MM-DD`, not a local-time shifted day.
3. Scroll the one Content body to its end. Confirm it requests the rest of the
   active day, then appends the next older populated day without an Older/Newer
   button or a sticky divider covering cards.
4. Inspect queued, active, failed/needs-review, and ready YouTube rows. Confirm
   each card shows the latest Analyze job's status, named stage, persisted
   message, and update freshness without a percentage. Open a pending or
   failed row and confirm the expanded state updates live; its only retry action
   exits to the canonical source rather than mutating from this read-only panel.
5. Open an analysed card. Its dossier shell must appear immediately. Under
   **Related coverage**, confirm every flat row names the relationship,
   rationale, creator take, creator/date, and creator source. Open one comparable
   dossier, then confirm Back names and restores the exact parent dossier before
   another Back returns to the originating tab and scroll position.
6. In News, confirm every report is an in-flow 112.5px-thumbnail evidence row
   inside its stored-date group: status/source, two-line title, two-line Why
   now, desktop source/claim counts, and a separate **Original source** anchor.
   Inspect the destination and confirm it is the projected reference URL, never
   the featured creator's YouTube URL. Exercise a status/source/project/topic
   filter and repeat the end-of-feed assertion when older eligible News exists.
   With none, confirm an explicit terminal empty state rather than indefinite
   loading.
7. Open a News row and confirm the same direct **Original source** anchor is
   present in detail. Then select Content, Concepts, or World. The detail
   overlay must clear immediately and reveal the chosen retained tab; use Back
   only to return to the originating reading context.
8. In Concepts, confirm projected dossier concepts and discovery tags appear as
   a bounded source-count lens. No comparison relationship or rationale may
   appear in this tab.
9. Capture desktop and 375px screenshots of cards, expanded progress, related
   coverage, News source links, and Concepts, plus browser console/page errors.

Run focused model/timeline tests and the production UI build alongside browser
proof. The source/job and editorial-gate contract is covered by
[FEAT-0117](../../../../../docs/features/FEAT-0117-video-intelligence.md).
