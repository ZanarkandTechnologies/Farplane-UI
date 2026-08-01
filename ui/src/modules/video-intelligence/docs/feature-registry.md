---
feature_refs: [FEAT-0117]
module: video-intelligence
updated_at: 2026-07-31
---

# Feature Registry

| Capability | Owner | Surface |
| --- | --- | --- |
| Durable video queue | YouTube loopback bridge | AI Office queue |
| Videos timeline | Video Intelligence projection | Videos tab |
| Stories timeline and tags | Video Intelligence sidecar | Stories tab |
| Cited video dossier | Video Intelligence sidecar | In-panel dossier |
| Story resolution | Video Intelligence sidecar | Same-story signal |
| Story aggregate rebuild | Video Intelligence sidecar | Story intelligence |
| Related-event derivation | Video Intelligence sidecar | Related events |
| Information-flow projection | Video Intelligence UI model | Story intelligence |
| Office launch | Shared office panel registry | Speed dial, palette, office object |

The panel reads `/farplane/video-intelligence`; it does not mutate sidecar
state.
