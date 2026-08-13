---
kind: qa-runbook
status: active
project: Farplane UI
created_at: 2026-08-13
updated_at: 2026-08-13
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
4. Open an analysed card. Its dossier shell must appear immediately; use Back
   to restore the originating tab, date groups, and scroll position.
5. In News, confirm every report is an in-flow 112.5px-thumbnail evidence row
   inside its stored-date group: status/source, two-line title, two-line Why
   now, and desktop source/claim counts. Exercise a status/source/project/topic
   filter and repeat the end-of-feed assertion when older eligible News exists.
   With none, confirm an explicit terminal empty state rather than indefinite
   loading.
6. Open a News row, then select Content, Concepts, or World. The detail
   overlay must clear immediately and reveal the chosen retained tab; use Back
   only to return to the originating reading context.
7. Capture desktop and 375px screenshots plus browser console/page errors.

Run focused model/timeline tests and the production UI build alongside browser
proof. The source/job and editorial-gate contract is covered by
[FEAT-0117](../../../../../docs/features/FEAT-0117-video-intelligence.md).
