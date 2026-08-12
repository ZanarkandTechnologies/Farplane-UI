---
feature_refs: [FEAT-0117]
module: video-intelligence
updated_at: 2026-08-13
---

# QA Runbook

Video Intelligence is exercised through Content Intelligence. Before browser
proof, run the configured deployment's read-only dossier/news reads, save a
compact date-group summary in the active ticket's `artifacts/qa/`, and record
the exact dates being inspected. Do not use `FARPLANE_STATE_DIR`: it is not a
fixture route for this module.

1. Require Content records on at least two observed dates. If a day contains
   more than 24 records, include that too; block pagination proof instead of
   fabricating records.
2. Start the UI and open `/office`, then launch **Content Intelligence**.
3. Confirm the shared dialog's Content tab has an in-flow date divider. Scroll
   to exhaust the active date and append an older day; there must be no date
   Previous/Next controls or sticky header overlapping cards.
4. Open a dossier, then Back. Confirm Content and its scroll context remain
   intact.
5. Open News, filter it, and confirm only eligible reports, source counts, and
   perspectives appear. When older matching News exists, prove it appends from
   the same end-of-feed interaction.
6. Open a report and verify reporting chronology, shared/distinct claims,
   frames, related events, timestamp links, and information-flow labels.
7. Confirm `contributes` maps to a StoryContribution and `related` maps to a
   persisted StoryRelation; neither is labeled citation or causality.
8. Reload the page and repeat the launch through an office-object binding.
9. Capture desktop/mobile libraries, dossier/story, empty, and
   malformed/unavailable states.
10. Record browser console errors and page errors with the screenshots.
