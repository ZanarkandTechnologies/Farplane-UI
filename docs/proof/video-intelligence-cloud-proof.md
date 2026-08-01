---
kind: proof-receipt
feature: FEAT-0117
verified_at: 2026-08-02
environment: configured Convex development deployment
---

# Video Intelligence Cloud Proof

## Write path

The origin-restricted local YouTube bridge calls ordinary Convex mutations,
matching the existing Resource Bank and Tasty Pack pattern. Video Intelligence
does not introduce a separate bridge credential.

## Historical projection

The deployed `getVideoIntelligenceProjection` query returned four jobs and four
legacy dossiers sourced from the existing Resource Bank, with these titles:

- I Made This Viral Reel Using ONLY Remotion & Claude Code
- Vox-Style Animated Charts With ONE PROMPT (Remotion + Claude Code)
- I Built a Vox Explainer Using Claude Code & Remotion (No Plugins)
- I Made Vox-Style Motion Graphics Using Only Claude Code & Remotion

The restarted loopback bridge returned the same four jobs from `POST /jobs`.

## Browser rendering

After restarting the stale Vite process, the actual AI Office panel rendered
all four Convex-backed videos. The prior process was still serving the removed
local polling hook even though the source file had changed on disk.

- Library screenshot: `docs/research/qa-testing/FEAT-0117/video-intelligence-library.png`
- Dossier screenshot: `docs/research/qa-testing/FEAT-0117/video-intelligence-dossier.png`
- Browser console errors: none

## Automated checks

- Convex TypeScript check passed.
- YouTube bridge type-check passed.
- YouTube bridge suite passed: 15 tests.
- Video Intelligence domain and UI model suites passed: 14 tests.
- AI Office production build passed.
