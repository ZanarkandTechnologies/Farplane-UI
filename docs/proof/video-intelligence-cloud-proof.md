---
kind: proof-receipt
feature: FEAT-0117
verified_at: 2026-08-02
environment: configured Convex development deployment
---

# Video Intelligence Cloud Proof

## Authorization boundary

The public `queueVideo` mutation was invoked directly with an incorrect bridge
credential and a valid YouTube ID. Convex rejected the call with
`video_intelligence_bridge_unauthorized`; no Resource Bank job or asset was
written.

```bash
pnpm exec convex run modules/videoIntelligence/videos:queueVideo \
  '{"bridgeSecret":"wrong","videoId":"dQw4w9WgXcQ","title":"Unauthorized probe"}'
```

Observed result: non-zero exit with `video_intelligence_bridge_unauthorized`.

## Historical projection

The deployed `getVideoIntelligenceProjection` query returned four jobs and four
legacy dossiers sourced from the existing Resource Bank, with these titles:

- I Made This Viral Reel Using ONLY Remotion & Claude Code
- Vox-Style Animated Charts With ONE PROMPT (Remotion + Claude Code)
- I Built a Vox Explainer Using Claude Code & Remotion (No Plugins)
- I Made Vox-Style Motion Graphics Using Only Claude Code & Remotion

The restarted loopback bridge returned the same four jobs from `POST /jobs`.

## Automated checks

- Convex TypeScript check passed.
- YouTube bridge type-check passed.
- YouTube bridge suite passed: 16 tests.
- Video Intelligence domain and UI model suites passed: 14 tests.
- AI Office production build passed.
