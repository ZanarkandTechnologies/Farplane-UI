---
kind: feature-spec
status: active
project: Farplane UI
created_at: 2026-07-31
updated_at: 2026-08-13
owner: video-intelligence
related_systems:
  - ../systems/content-capture-and-analysis.md
source_refs:
  - ../../apps/youtube-shortcut/scripts/local-agent.ts
  - ../../apps/youtube-shortcut/scripts/video-intelligence-cloud.ts
  - ../../convex/modules/videoIntelligence/
  - ../../ui/src/modules/content-intelligence/README.md
  - ../../ui/src/components/office-workspace-dialog.md
  - ../../ui/src/modules/video-intelligence/README.md
  - ../../docs/MEMORY.md
  - ../proof/video-intelligence-cloud-proof.md
external_grounding:
  - local Cura video library and dossier implementation
  - official Convex functions and schema documentation
---

# Video Intelligence

Video Intelligence is the YouTube-analysis branch inside Content Intelligence.
It turns Farplane's YouTube shortcut into durable,
evidence-backed viewing memory. It stores the ingest lifecycle before analysis
finishes, creates one dossier per YouTube video, links reported events and
claims to provisional stories, and regenerates each story comparison from all
current source contributions. AI Office presents timeline-grouped Videos and
Stories libraries before drilling into a dossier or story-intelligence view.

## Behavior Contract

```text
YouTube request
  -> persisted queue item
  -> structured analysis
  -> cited video dossier
  -> one or more story contributions
  -> existing or provisional story
  -> regenerated story aggregate
  -> read-only AI Office projection
```

- A queue item is written before the long-running Codex analysis begins.
- Browser-cache hits still enter the durable queue through `/ingest-cached`;
  they do not launch another Codex analysis task.
- One dossier, keyed to the canonical shared content source, owns repeated ingests of the same YouTube video.
  The dossier records its repeat count rather than duplicating story evidence.
- A video may contribute to up to three reportable stories.
- A story is one time-bounded event. Stable tag records group longer-running
  themes without changing story identity.
- Story resolution rejects conflicting event dates, then scores normalized
  title-token overlap and named-entity overlap. Low-confidence input creates a
  provisional story instead of forcing a merge.
- Claims are compared only within an already-linked story. Repeated claims
  across different dossiers become shared reporting; the rest remain
  source-specific reporting.
- The story aggregate is the comparison surface. There is no separate
  user-facing comparison-run entity.
- The current aggregate is rebuilt after every contribution write and remains
  reproducible from structured contributions.
- Conservative `related` edges require either one shared non-generic tag plus
  one shared entity, or two shared entities. They never imply citation,
  causality, correction, or derivation.

## Library and navigation contract

- Content Intelligence opens to Content, its all-source read surface. It loads
  the newest observed day, exhausts that day's item page, then appends the next
  older populated day when the reader reaches the end of the same scroll body.
  This is end-of-feed automatic pagination, not manual date navigation or a
  top-of-feed refresh gesture.
- News uses the same chronological feed mechanism after applying its filters.
  It contains only current, editorially eligible reports; Stories remain
  evidence/detail records rather than a primary tab.
- Date dividers are ordinary in-flow headings. Exact `YYYY-MM-DD` values and
  ISO timestamps retain their original stored UTC day, so browser timezone
  conversion cannot move a card under a different visible date.
- Selecting Content, News, or related coverage replaces the panel body with a
  dossier or story-intelligence view. Back preserves the active tab, filters,
  loaded chronological groups, and scroll context.
- Selecting any primary tab is an explicit navigation action: it clears a
  currently open detail overlay and reveals that tab's retained library state.
- News is a compact evidence list rather than a card grid or hero-led
  dashboard. Every date-grouped row has a square known cited-contributor
  thumbnail, status/source, bounded title, two-line `Why now`, and source/claim
  counts; the opened report owns the fuller explanation and related coverage.
  A visual never alters source attribution or report status.
- Story intelligence shows reporting chronology, perspectives, shared and
  source-specific claims, related events, and a read-only information-flow
  projection.
- In the flow projection, `contributes` means a video supplied a persisted
  StoryContribution and `related` means only the conservative tag/entity rule.

## Editorial News and recurring Topics

Every successful analysis creates a dossier. It always returns the base dossier
and recurring Topic coverage; `news` is nullable additive enrichment rather
than a source type or alternative route. The local bridge passes its current
UTC `newsAsOf` day into analysis. A tutorial, opinion, forecast, history, or
commentary returns `news: null`; a source that reports a current public,
material development may include zero to three News candidates. The server
publishes a candidate only when it contains an exact current event day, a claim
citing the same verbatim public `eventKey`, and short `whyNow` and
`whyItMatters` explanations. Channel branding and Feed Scout discovery never
decide News eligibility.

Recurring coverage is stored as a month-bounded Topic independent of News.
The analysis returns a named Topic plus supporting tags even when `news` is
null, so recurring coverage such as AI-assisted income can group creator
perspectives without pretending to report a new event. An authored Topic may
carry one constrained `[[world/entity-id]]` reference; that reference is
validated by Video Intelligence and never writes World state.

News comparisons use only contributions belonging to a dossier's current,
immutable analysis revision. A single verified source authority is labelled
**Developing**; **Aggregated** requires two distinct immutable authority keys
on the same exact event key and day. Legacy contributions remain retained as
unreviewed dossier/topic evidence and never enter default News.

## Tag contract

Tags use stable records rather than copied strings:

```text
Tag {
  id
  canonicalName
  normalizedKey
  aliases[]
  provenance[]
}
```

Normalization folds case, punctuation, whitespace, and conservative plural
variants. Later spellings become aliases. The current UI can filter and display
tags but remains read-only; rename/merge governance is deferred.

## Evidence Contract

Every persisted reporting claim carries:

- YouTube video ID and canonical source URL
- source status and source kind (`transcript` or reliable page-owned material)
- a short source excerpt
- optional real timestamp
- schema version and extractor version

The analyzer must not fabricate timestamps. A null timestamp links to the
source without implying a time. Claims without a source excerpt are rejected by
the structured schema.

## Convex Cloud Contract

Canonical records live in the existing Convex deployment:

```text
contentSources -> contentJobs(kind: analyze_youtube) -> videoIntelligenceDossiers
                                                    -> videoIntelligenceContributions
                                                    -> videoIntelligenceStories
                                                    -> videoIntelligenceTags
```

Video Intelligence owns analysis jobs; it must not create Resource Bank assets,
analyses, or taste elements. Resource Bank is only the explicit save path:
`contentJobs(kind: save_reference)` may attach a reusable source asset and
pinned creative elements. Both paths reuse a `contentSource` when they refer to
the same URL, but neither implies the other. The durable cross-feature map,
including migration and skill boundaries, lives in
[Content Capture And Analysis](../systems/content-capture-and-analysis.md).

## Application Surfaces

- The YouTube extension calls the origin-restricted loopback bridge.
- The origin-restricted local bridge calls ordinary Convex mutations, matching
  the existing Resource Bank and Tasty Pack storage pattern.
- `POST /analyze-youtube` persists queued/running/completed/failed lifecycle.
- `POST /ingest-cached` records a validated browser-cache hit.
- `POST /jobs` returns the durable queue to the extension popup.
- AI Office subscribes directly to the Convex Video Intelligence projection.
- AI Office launches one **Content Intelligence** dialog through the shared
  registry, command palette, keyboard shortcut, and office-object binding.
  Content is the all-source paginated entrypoint; News preserves this feature's
  cited reporting boundary; recurring Topic coverage appears only as
  dossier-scoped **Related coverage** when another current source shares the
  lens; Concepts is a bounded tag adapter; World remains the Entity Markdown
  projection.
- The workspace is read-only. YouTube analysis still exposes its dossiers,
  project-relevance hints, story perspectives, and honest information flow;
  it has no write path and does not turn viewing into a Resource Bank Save.
- Content Intelligence composes the shared `OfficeWorkspaceDialog`. The shell
  owns the viewport-safe frame, focus, overlay, and close behavior; the module
  owns headers, tabs, and one body scroll region. A detail view must retain
  library context instead of creating nested active scrollers.

## Channel backfill contract

- A channel backfill reuses the browser extension's origin-restricted
  `POST /analyze-youtube` route; it does not create a second ingestion path.
- Backfill analysis explicitly uses `gpt-5.6-luna` with reasoning effort `max`.
- The local bridge treats useful app-server progress as liveness with a
  180-second idle timeout and a separate 15-minute absolute cap.
- The resumable manifest runner allows at most five active sources, waits on
  an already-running canonical job instead of duplicating it, skips a
  succeeded source already assigned to its requested project, retries only
  transient timeout/transport failures once, and stops on authentication
  invalidation. Source-unavailable results remain visible and classified as
  failures rather than receiving fabricated dossiers.
- When a project association is supplied, it is written to the shared analysis
  job. The Video Intelligence projection exposes that association for
  reconciliation; semantic `projectRelevance` remains analysis-owned.

## Limits

- Story matching is deterministic and intentionally conservative, not a truth
  or editorial-bias score.
- Project relevance is an analysis hint grounded only in explicitly named work
  from the operator profile. It does not mutate project memory.
- Publisher reputation, editable graph visualization, tag/topic merge/split
  governance, multi-user permissions, and non-YouTube ingestion are
  deferred.
- Markdown and graph views may be derived later from the structured records,
  but neither may be parsed back into canonical state.

## Proof

- Two analyses completing through Convex mutations resolve as one
  story with two perspectives and shared cited reporting.
- Re-ingesting one video preserves one dossier and increments its repeat count.
- A failed analysis remains visible in Convex after bridge restart.
- Existing Resource Bank YouTube assets appear as legacy dossiers before any
  Video Intelligence-specific backfill.
- AI Office can open the same persisted queue, dossier, and story comparison
  through the Content Intelligence entrypoint, while a Feed Scout observation
  of the same strict canonical YouTube URL reuses the source rather than the
  analysis job.
