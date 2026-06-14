---
id: TKT-028
title: Resource Bank Ingestion Module And Office Renderer
state: review
owner: Farplane UI
assignee: Codex
created_at: 2026-06-14
complexity: L
skills:
  - ingest-content
  - convex
---

# TKT-028: Resource Bank Ingestion Module And Office Renderer

## Status

- state: `review`
- owner: Farplane UI
- assignee: Codex
- location: `tickets/review/TKT-028-resource-bank-ingestion-module`
- dependencies: `$ingest-content`, Convex AI guidance refresh, Farplane shell module registry, office QA cookbook
- enter when: operator wants a Farplane-native resource bank for saved media, source analysis, extracted skill knowledge, and agent retrieval
- leave when: human review accepts schema/API/UI evidence and push artifacts
- blockers: material storage boundary decision if LocalPinterest must remain the only backing store
- spawned follow-ups:
  - optional browser extension / share-sheet capture
  - optional autonomous trend scout or popularity learner
  - optional generation skill that consumes resource-bank retrieval packets
- complexity: `L`

## Description

Build a Farplane resource bank for references the operator finds tasty: images,
videos, links, files, screenshots, and raw notes. Each capture should become an
ingestion job with one primary asset, optional derived assets such as clips,
frames, thumbnails, or transcripts, the operator note, source analysis, extracted
skill findings, provenance, tags, embeddings/search metadata, and optional
task/project links.

This is not a passive scraper or posting loop. The first slice should make
explicit saves durable, searchable, inspectable, and reusable by agents.

## Goal

Create a Convex-backed `resource-bank` module plus a Farplane UI module that
turns `$ingest-content` outputs into searchable media assets and extracted
skill knowledge. The system must support recency, full-text search, vector
similarity, tag/facet filtering, task/project links, and an agent-facing
retrieval function.

## Product Pattern Notes

- Eagle is strong at dense visual reference management and now emphasizes AI
  search by image, meaning, and cross-source recall.
- Cosmos is closer to taste discovery: visual bookmarking, collections or
  clusters, color/image/keyword search, and source/story enrichment.
- mymind and Fabric point toward low-friction capture: save anything, avoid
  manual organization, let AI tags/summaries/search recover it later.
- Farplane's differentiated angle is actionability: store not only the source
  and tags, but also what skill or technique the source demonstrates, how to
  reuse it, and whether an existing skill should be used, updated, or created.

References checked on 2026-06-14:

- `https://en.eagle.cool/`
- `https://www.cosmos.so/`
- `https://fabric.so/`
- `https://mymind.com/`
- `https://docs.convex.dev/search`
- `https://docs.convex.dev/search/vector-search`
- `https://docs.convex.dev/search/text-search`

## Recommended Architecture

### Storage Boundary

Use Farplane Convex as the office-native resource bank. Keep the LocalPinterest
contract import-compatible so `$ingest-content` can either write directly to
Farplane or bridge from the existing LocalPinterest project.

Decision signature:

```text
resource_bank_capture(source, note?, context?) -> ingestion_job + primary_asset + analysis + skill_findings + retrieval_handle
```

Accepted tradeoff: Farplane owns a compact resource-bank index so the office
launcher, UI renderer, and agents can query it without depending on a separate app
runtime. Raw bulky media can remain as source URLs, Convex storage files,
selected clips, frames, thumbnails, transcripts, or external retention handles.
Do not split the model into many domain tables until a real UI/query proves the
need.

### Convex Module

Create:

```text
convex/modules/resourceBank/
  AGENTS.md
  README.md
  schema.ts
  validators.ts
  ingestionJobs.ts
  assets.ts
  search.ts
  skillFindings.ts
```

Compose tables from root `convex/schema.ts`. Before implementation, install or
refresh Convex AI files because `convex/_generated/ai/guidelines.md` is absent
in this checkout.

### Proposed Tables

```text
resourceBankIngestionJobs
  _id
  sourceKind: url | image | video | audio | file | note | screenshot | clip
  sourceRef: string                       // URL, local path, storage id, or manual note id
  originalInstruction: string?
  note: string?
  requestedFocus: string?                 // e.g. "first minute", "lighting", "editing"
  sourceScope: {
    startMs?: number
    endMs?: number
    pageRange?: string
    regionLabel?: string
  }?
  tags: string[]
  projectId?: string
  taskId?: string
  externalTaskRef?: string                // Notion/task URL/id when provided
  requestedBy: string?
  status: queued | analyzing | ready | failed | needs_review
  sourcePrivacy: public | local | private | unknown
  error: string?
  createdAtMs
  updatedAtMs
  completedAtMs?

resourceBankAssets
  _id
  ingestionJobId
  parentAssetId?                          // derived clip/frame/transcript points to primary asset
  assetRole: primary | derived | evidence | thumbnail | transcript
  assetKind: url | image | video | audio | file | note | screenshot | clip | frame | transcript
  title
  sourceUrl?
  canonicalUrl?
  storageId?
  localPath?
  mimeType?
  width?
  height?
  durationMs?
  startMs?
  endMs?
  platform?
  author?
  attributionStatus: known | partial | unknown
  tags: string[]
  searchableText
  retentionNote?
  createdAtMs
  updatedAtMs

resourceBankAnalyses
  _id
  ingestionJobId
  assetId
  analysisType: summary | visual | video | copy | style | prompt | skill-extraction | usefulness
  sourceSkill
  facts: string[]
  interpretation: string[]
  userIntent: string?
  whyItWorks: string[]
  takeaways: string[]
  transcriptText?
  frameNotes?
  promptGuess?
  remixConstraints: string[]
  confidence: low | medium | high
  embeddingText
  embeddingModel?
  embedding?
  createdAtMs

resourceBankSkillFindings
  _id
  ingestionJobId
  assetId
  analysisId
  findingKind: existing_skill | skill_candidate | skill_update | reusable_technique
  skillId?
  skillPath?
  label
  capability
  evidenceAnchor                       // timestamp, frame, transcript quote, page section, note
  howToReuse
  suggestedSkillChange?
  tags: string[]
  confidence: low | medium | high
  embeddingText
  embeddingModel?
  embedding?
  createdAtMs
```

Tag convention:

```text
tags: string[]

intent:future-video
intent:reuse-bg
format:2x2-grid
format:caption-bar
style:academic-chaos
style:dense-background
retrieval:landing-page-inspo
project:farplane
platform:tiktok
```

Use typed tags instead of parallel tag arrays for v1. Tags should be stored as
lowercase `type:slug` strings so the schema stays simple, search filters remain
easy to compose, and future skills can still ask for intent, format, style, or
retrieval-specific tags by prefix. Add a first-class tag table later only when
we need aliases, descriptions, usage counts, merge history, or manual curation.

Indexes:

- recency: `resourceBankAssets.by_createdAtMs`
- job status/project/task: `resourceBankIngestionJobs.by_status_createdAtMs`,
  `by_project_createdAtMs`, `by_task_createdAtMs`
- tag/facet filters: typed tag filters over `tags` by prefix, with a later
  normalized tag table only if array filtering is not enough for the UI scale
- gallery full text: `resourceBankAssets.searchableText`
- gallery vector: `resourceBankAnalyses.embedding`, filtered by asset/job
- skill vector: `resourceBankSkillFindings.embedding`, filtered by skill/finding kind

## Query And Mutation Surface

```text
createIngestionJob({ source, note?, context?, sourcePrivacy? }) -> jobId
addResourceAsset({ jobId, asset }) -> assetId
addResourceAnalysis({ jobId, assetId, analysis }) -> analysisId
addSkillFinding({ jobId, assetId, analysisId, finding }) -> findingId
completeIngestionJob({ jobId }) -> ok
searchGallery({ query?, tags?, assetKind?, recency?, projectId?, taskId?, limit? }) -> asset_matches[]
searchSkillFindings({ query?, tags?, skillId?, findingKind?, recency?, limit? }) -> finding_matches[]
findSimilarAssets({ text?, embedding?, assetId?, tags?, limit? }) -> asset_matches[]
retrieveForCreation({ goal, outputType?, tags?, recency?, count? }) -> retrieval_packet
getResourceAsset({ assetId }) -> asset + analyses + skill_findings + derived_assets
linkJobToTask({ jobId, projectId?, taskId?, externalTaskRef? }) -> ok
```

Agent retrieval packet:

```text
retrieve_for_creation(goal, filters?) -> {
  query,
  top_matches: [
    {
      assetId,
      title,
      why_relevant,
      skill_findings,
      source_analysis,
      prompt_guess,
      remix_constraints,
      attribution,
      source_handle
    }
  ],
  tag_expansions,
  retrieval_notes
}
```

## UI Shape

Create `ui/src/modules/resource-bank/` and register it as a first-party module.
The module should have two render modes: a dense card/search workbench and an
office-friendly cluster renderer. A graph can be used visually, but it should be
computed from asset similarity, tags, and skill findings rather than stored as a
separate graph table in v1.

Default desktop layout:

```text
+----------------------------------------------------------------------------------+
| Resource Bank                                      [Search tasty references...]   |
| [All] [Images] [Video] [Links] [Recipes] [Recent] [Similar]        [+ Capture]   |
+----------------------+-------------------------------------+---------------------+
| Facets               | Cluster / Similarity View            | Selected Asset      |
|                      |                                     |                     |
| Intent               |        (caption-bar)                | thumbnail / frame    |
| [x] future-video     |             o                       | Title                |
| [x] retrieval:reuse-bg|        o---+---o                   | Source / attribution |
| [ ] landing-page     |       o     |     o                 | Tags                 |
|                      |             o                       |                     |
| Format               |   [cluster: study chaos]            | Why it works         |
| [ ] 2x2-grid         |       o---o---o                     | - lever              |
| [ ] talking-head     |                                     | - lever              |
| [ ] caption-bar      |   Cards below update from cluster    |                     |
|                      |   selection/search.                  | Skill findings       |
| Sort                 |                                     | [layout] [recipe]    |
| ( ) newest           +-------------------------------------+                     |
| ( ) closest          | Result Cards                                                |
| ( ) most reused      | [thumb] title tags    [thumb] title tags    [thumb] title  |
+----------------------+-----------------------------------------------------------+
```

Office object / compact renderer:

```text
+---------------------------------------------------+
| Resource Bank Shelf                               |
| [Search...] [Recent] [For current project]         |
|                                                   |
|  o--o  AI agent video hooks                       |
|   \ |  12 assets | 37 skill findings | 5 candidates |
|    o                                              |
|                                                   |
| Recent tasty saves                                |
| [img] caption-bar collage  [vid] first-3-sec hook |
| [url] landing page hero    [note] bg recipe       |
+---------------------------------------------------+
```

Cluster rendering rules:

- Nodes: assets, skill findings, and high-signal tags generated at query time.
- Edges: vector similarity, shared tags, same job, same project/task, or shared
  skill finding generated at query time.
- Clustering: start with backend-provided similarity/tag groups. A UI force
  graph can improve layout, but semantic cluster labels should come from stored
  tags and skill findings so agents and UI agree.
- Search interaction: query filters both cards and clusters; clicking a cluster
  opens the top assets plus a retrieval packet preview.
- No raw-media wall as the only UI. Always show the extracted skill findings.

## Implementation Plan

### 1. Ground Convex And Existing Skill Contract

- Refresh/install Convex AI guidance if needed.
- Read `$ingest-content` references:
  - `localpinterest-contract.md`
  - `reuse-taxonomy.md`
  - `phase-router.md`
- Decide whether v1 writes directly into Farplane Convex or imports from the
  existing LocalPinterest project, then record the adapter boundary.

### 2. Backend Schema And APIs

- Add `convex/modules/resourceBank`.
- Implement validators and module-prefixed tables.
- Add mutations for job creation and completed ingestion writes.
- Add queries for asset detail, recent list, full-text gallery search,
  skill-finding search, cluster view, and agent retrieval packet.
- Add vector search action/query surface using Convex vector search where
  embeddings are present; degrade to text/tag search when no embedding exists.

### 3. Ingestion Skill Bridge

- Add or update a callable path so `$ingest-content` can write:
  - original instruction / note
  - source and retained asset handles
  - facts vs interpretation vs user intent
  - extracted skill findings
  - prompt guess and remix constraints
  - tags and embeddings/search text
- Verify `getResourceAsset` returns the full saved packet.

### 4. UI Module

- Create `ui/src/modules/resource-bank/` with README, AGENTS, docs, components,
  hooks, and local tests.
- Register the module in the shell registry and launcher surface.
- Implement card/search workbench plus compact office shelf renderer.
- Use shared theme tokens and compact dashboard density.

### 5. Cluster Prototype

- Render clusters from `searchGallery` and `searchSkillFindings`.
- Start with assets/skill findings/tags, similarity scores, cluster labels, and
  selected asset detail.
- Support search, recency filter, tag filters, and selected-node detail.

### 6. Proof

- Seed at least five representative records:
  - image reference
  - short-form video reference with segment
  - webpage/link reference
  - note-only recipe
  - generated prompt/asset recipe
- Verify recent search, tag search, full-text search, similar asset retrieval,
  skill-finding retrieval, and cluster render.
- Capture browser screenshots for workbench, cluster view, compact office renderer,
  selected item detail, and empty state.

## Acceptance Criteria

- [x] AC-1: Resource Bank exists as a Farplane Convex module with module-prefixed tables and root schema composition.
- [x] AC-2: Ingestion jobs store original source, note/instruction, status, timestamps, and failure state.
- [x] AC-3: Completed jobs store a primary asset, optional derived assets, analyses, skill findings, tags, attribution, searchable text, and recency fields.
- [x] AC-4: Facts, Codex interpretation, and operator intent remain separate in stored analysis records.
- [x] AC-5: Extracted skill findings are first-class records, not only prose in a summary.
- [x] AC-6: Search supports recent, full-text, tag/facet, and semantic/vector paths when embeddings exist.
- [x] AC-7: Agent-facing `retrieveForCreation` returns top asset matches with relevance reasons, skill findings, remix constraints, attribution, and source handles.
- [x] AC-8: Cluster API/view model returns assets, skill findings, tag groups, similarity reasons, and weights suitable for UI rendering.
- [x] AC-9: Resource Bank UI module renders searchable cards, clusters, selected asset detail, and compact office shelf states.
- [x] AC-10: UI makes extracted skill findings visible without requiring the operator to open raw media.
- [x] AC-11: Empty, loading, failed-ingestion, no-results, and populated states are handled.
- [x] AC-12: Browser QA captures workbench, cluster view, selected detail, compact office shelf, and empty state.
- [x] AC-13: Focused Convex/type/unit tests cover validators, retrieval ranking/degradation, and cluster shaping.

## Agent Contract

- Open:
  - `PROJECT_RULES.md`
  - `convex/AGENTS.md`
  - `convex/_generated/ai/guidelines.md` after refreshing if absent
  - `ui/src/modules/AGENTS.md`
  - `$ingest-content` and its three reference files
- Test hook:
  - `npx tsc -p convex/tsconfig.json --noEmit`
  - focused Vitest for `resourceBank` helpers
  - browser QA from `qa/README.md` and relevant office/module cookbook
- Stabilize:
  - seeded records produce deterministic screenshots
  - no bulky raw media stored without explicit retention note
  - query functions cap limits and avoid full-table scans outside controlled search APIs
- Inspect:
  - schema indexes
  - generated Convex API shape
  - shell module registry
  - cluster/search payloads
- Key screens/states:
  - empty vault
  - capture/job status list
  - recent/search card grid
  - cluster view
  - selected asset detail with skill findings
  - compact office shelf
- Taste refs:
  - Eagle dense visual reference library
  - Cosmos visual/taste discovery and clusters
  - mymind/Fabric frictionless save-anything search
- Expected artifacts:
  - backend schema/API files
  - resource-bank UI module files
  - seeded sample data or fixture
  - QA screenshots and report
- Delegate with:
  - one backend lane for Convex schema/API
  - one frontend lane for UI/cluster renderer
  - one QA lane for browser evidence

## Evidence Checklist

- [x] Screenshot: Resource Bank empty state
- [x] Screenshot: populated search/card workbench
- [x] Screenshot: cluster view
- [x] Screenshot: selected reference detail showing skill findings
- [ ] Screenshot: compact office shelf renderer
- [ ] Snapshot: seeded retrieval packet JSON
- [x] Snapshot: cluster/search JSON
- [x] QA report linked

## Build Notes

- Prefer explicit Farplane `resource-bank` ownership over adding this to
  `skills-studio`, `team-workspace`, or a generic `memory` module.
- Treat embeddings as derived metadata stored on the same table as the record
  being retrieved. V1 stores `embedding`, `embeddingText`, `embeddingModel`, and
  `embeddingTarget` directly on `resourceBankAnalyses` and
  `resourceBankSkillFindings`.
- V1 embeds exactly two text shapes:
  - `analysis_search`: facts, operator intent, interpretation, why-it-works,
    takeaways, prompt guess, remix constraints, frame notes, and transcript text.
  - `skill_finding_search`: label, capability, evidence anchor, how-to-reuse,
    suggested skill change, and typed tags.
- V1 vector indexes use 1536 dimensions. If the embedding model changes, add a
  new field/index or migrate deliberately; Convex vector indexes require a fixed
  dimension matching the stored vectors.
- Use Convex built-in vector search first. Defer `@convex-dev/rag` until the
  vault needs chunking, namespaces, importance weighting, surrounding chunk
  context, or migration helpers for a larger text corpus.
- If embedding generation is unavailable, store the pending state and keep
  tag/full-text retrieval working.
- Keep visual clusters explainable through search results, tags, similarity
  scores, and skill findings. Do not make the visual graph a separate source of truth.
- Keep manual notes and Codex observations separate.
- Avoid direct creative copying. Persist attribution and remix constraints.

## QA Reconciliation

- AC-1: `PASS`
- Screen: `PASS`
- Evidence item: `CAPTURED`

## Artifact Links

- Empty-state browser proof: `artifacts/resource-bank-panel.png`
- Populated browser proof: `artifacts/resource-bank-populated.png`
- Browser assertion JSON: `artifacts/browser-proof.json`
- Populated assertion JSON: `artifacts/browser-proof-populated.json`

## User Evidence

- Hero screenshot: `artifacts/resource-bank-populated.png`
- Supporting evidence: `artifacts/resource-bank-panel.png`
- QA report: `artifacts/browser-proof-populated.json`
- Final verdict: `review-ready with headless WebGL warning from office scene`

## Required Evidence

- [x] Convex typecheck passes
- [x] Focused tests pass
- [x] UI typecheck or touched-file typecheck passes
- [x] Browser screenshots prove required UI states
- [x] QA report reconciles acceptance criteria
