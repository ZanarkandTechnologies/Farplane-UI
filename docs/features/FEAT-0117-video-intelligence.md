---
kind: feature-spec
status: active
project: Farplane UI
created_at: 2026-07-31
updated_at: 2026-07-31
owner: video-intelligence
related_systems:
  - ../systems/README.md
source_refs:
  - ../../apps/youtube-shortcut/scripts/local-agent.ts
  - ../../apps/youtube-shortcut/scripts/video-intelligence-store.ts
  - ../../ui/src/modules/video-intelligence/README.md
  - ../../docs/MEMORY.md
external_grounding:
  - local Cura video library and dossier implementation
  - official Convex functions and schema documentation
---

# Video Intelligence

Video Intelligence turns Farplane's YouTube shortcut into durable,
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
- One deterministic dossier ID owns repeated ingests of the same YouTube video.
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

- Video Intelligence opens to the Videos library.
- Videos are grouped by their latest ingest/update date and deduplicated by
  YouTube video ID. Queued, running, failed, and completed states share the
  same timeline.
- Stories are grouped by event date, falling back to the last story update when
  the date is unknown.
- Videos and Stories are the only primary tabs. Selecting an item replaces the
  panel body with its dossier or story intelligence; Back preserves the active
  tab, search, tag filter, and scroll context.
- Story intelligence shows reporting chronology, perspectives, shared and
  source-specific claims, related events, and a read-only information-flow
  projection.
- In the flow projection, `contributes` means a video supplied a persisted
  StoryContribution and `related` means only the conservative tag/entity rule.

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

## Sidecar Contract

The canonical file is:

```text
FARPLANE_STATE_DIR ||
FARPLANE_HOME ||
~/.farplane
  /video-intelligence/state.json
```

State schema v2 contains jobs, dossiers, stories, tags, related-story edges,
contributions, aggregates, a monotonically increasing revision, and an updated
timestamp. The single loopback writer serializes read-modify-write operations
and commits through atomic rename. Valid v1 state is projected into v2 without
mutating on read, preserves existing record IDs, and persists as v2 on the next
write. Interrupted temporary files are ignored. A malformed canonical file or
unsupported future schema fails closed.

## Application Surfaces

- The YouTube extension calls the origin-restricted loopback bridge.
- `POST /analyze-youtube` persists queued/running/completed/failed lifecycle.
- `POST /ingest-cached` records a validated browser-cache hit.
- `POST /jobs` returns the durable queue to the extension popup.
- `GET /farplane/video-intelligence` returns the browser-safe local projection.
- AI Office launches one dense Video Intelligence panel through the shared
  launcher registry, command palette, keyboard shortcut, and office-object
  binding.
- The panel exposes Videos and Stories timelines, dossiers,
  project-relevance hints, story perspectives, and honest information flow; it
  has no write path.

## Limits

- Story matching is deterministic and intentionally conservative, not a truth
  or editorial-bias score.
- Project relevance is an analysis hint grounded only in explicitly named work
  from the operator profile. It does not mutate project memory.
- Publisher reputation, editable graph visualization, tag/topic merge/split
  governance, cloud sync, multi-user permissions, and non-YouTube ingestion are
  deferred.
- Markdown and graph views may be derived later from the structured records,
  but neither may be parsed back into canonical state.

## Proof

- Two analyses completing through overlapping writes survive reload as one
  story with two perspectives and shared cited reporting.
- Re-ingesting one video preserves one dossier and increments its repeat count.
- A failed analysis remains visible in the queue after bridge restart.
- AI Office can open the same persisted queue, dossier, and story comparison
  through the registry-driven entrypoint.
