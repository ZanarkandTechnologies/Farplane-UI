---
feature_refs: [FEAT-0117]
module: video-intelligence
updated_at: 2026-07-31
---

# QA Runbook

Seed an isolated Farplane state root with multiple dated videos, two completed
dossiers on one story, two related event-level stories, one running job, and
one failed job.

1. Start the UI with `FARPLANE_STATE_DIR` pointing at the seed.
2. Open `/office` and launch **Video Intelligence** from the shared office menu.
3. Confirm Videos groups by ingest timeline and exposes pending/failed/completed
   status without a separate Queue screen.
4. Open a dossier, open its linked story, then Back twice. Confirm Videos,
   search, and scroll context are unchanged.
5. Open Stories, filter by a tag, and confirm event-date grouping, source
   counts, and perspectives.
6. Open a story and verify reporting chronology, shared/distinct claims,
   frames, related events, timestamp links, and information-flow labels.
7. Confirm `contributes` maps to a StoryContribution and `related` maps to a
   persisted StoryRelation; neither is labeled citation or causality.
8. Reload the page and repeat the launch through an office-object binding.
9. Capture desktop/mobile libraries, dossier/story, empty, and
   malformed/unavailable states.
10. Record browser console errors and page errors with the screenshots.
