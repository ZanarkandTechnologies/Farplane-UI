---
id: FP03
title: Taste Bank And Tasty Packs
status: Draft
created: 2026-06-26
owner: Farplane UI
source_ticket: tickets/review/TKT-028-resource-bank-ingestion-module/ticket.md
source_skill: /Users/kenjipcx/.codex/skills/ingest-content/SKILL.md
---

# FP03: Taste Bank And Tasty Packs

## Purpose

Farplane should turn the operator's taste into a reusable creative system.

The operator already finds high-signal inspiration while scrolling: reels,
images, clips, captions, edits, hooks, styles, and ideas that feel tasty. The
current failure mode is that this taste gets trapped in platform bookmarks and
decays after a week. Taste Bank makes those saves actionable: every explicit
capture becomes searchable source material, reusable creative ingredients, and
agent-readable context for future content creation.

This spec promotes the Resource Bank implementation from "media inspiration
database" into a product doctrine:

```text
operator taste
  -> captured references
  -> extracted creative ingredients
  -> time-window Tasty Packs
  -> mix-and-match generation briefs
  -> new content that reuses taste without copying sources
```

## Product Thesis

Human creators do not make from nothing. They remix what they noticed recently:
the best hooks, visual grammars, sounds, pacing, formats, and emotional signals
around them. Farplane should help the operator use their own taste as a creative
input stream.

The product is not a passive bookmark manager. It is a taste feedback loop.

```ts
capture_taste(source, note?, context?) -> saved_reference + reusable_ingredients;

create_tasty_pack(goal, timeframe, filters?) -> references + ingredient_map + generation_brief;
```

## Existing Source Of Truth

There was no durable `docs/features/FEAT-*.md` product spec for this tastiness system
before this file.

Existing related artifacts:

- `tickets/review/TKT-028-resource-bank-ingestion-module/ticket.md` describes
  the first implementation slice: Convex-backed Resource Bank tables, UI panel,
  search, and agent retrieval.
- `convex/modules/resourceBank/README.md` describes the current backend module.
- `$ingest-content` defines the capture/analyze/store skill behavior.

This spec owns the long-term product contract. TKT-028 remains an implementation
ticket for the first slice.

## Vocabulary

- **Taste Bank**: the product concept. A personal creative memory system based
  on explicitly saved taste.
- **Resource Bank**: the current implementation/module name for stored assets,
  analyses, and skill findings.
- **Tasty content**: any explicitly saved source the operator finds useful,
  beautiful, weird, funny, instructive, trendy, or strategically reusable.
- **Tastiness signal**: why the operator saved it. This must include the note,
  not only AI-generated tags.
- **Creative ingredient**: a reusable part extracted from a source, such as a
  hook, format, pacing pattern, visual style, sound cue, caption structure, shot
  recipe, or remix constraint.
- **Tasty Pack**: a time-windowed bundle of recent saved references and
  extracted ingredients for a specific creation goal.
- **Idea Sink**: a user-facing prompt surface where the operator describes a
  content idea and asks Farplane to retrieve relevant tasty material.

## Core Loop

```text
1. Operator finds tasty content.
2. Operator calls ingest with a source and note.
3. Ingestion reads or records source limits.
4. Analysis extracts creative ingredients and confidence/provenance.
5. Resource Bank stores source, note, tags, analysis, and skill findings.
6. Later, operator describes new content to make.
7. Farplane builds a Tasty Pack from recent and relevant saves.
8. Tasty Pack becomes a generation brief, storyboard, prompt, or ticket.
```

The note is first-class. It is often more valuable than the source metadata
because it captures the operator's taste at the moment of discovery.

## Product Requirements

### Capture

Taste capture must support:

- URL, image, video, screenshot, file, clip, transcript, or note-only sources.
- Optional operator note.
- Optional project, task, audience, campaign, or future content context.
- Optional segment focus such as `0-3s hook`, `first minute`, `lighting`,
  `caption style`, `background`, `audio cue`, or `editing rhythm`.
- Source privacy and retention notes.

First interface:

```text
$ingest-content <source> note="<why this is tasty / how I might reuse it>"
```

Later interfaces:

- browser/share-sheet capture
- Telegram or mobile capture
- drag/drop into Resource Bank
- direct capture from the Resource Bank UI

### Ingestion Analysis

Each capture should produce a compact evidence-aware analysis:

- what the source is
- what the operator liked
- what is source-backed versus note-backed versus inferred
- why it works
- reusable creative ingredients
- prompt or shot recipe when useful
- remix constraints
- confidence

If frames, transcript, or audio cannot be accessed, the record must say so
instead of pretending the source was fully understood.

### Storage

The v1 model should stay compact:

```text
ingestion job -> primary asset -> analyses -> creative elements
                                      -> skill findings
              -> derived assets such as frames, clips, transcripts, thumbnails
```

Keep embeddings on analysis, creative element, and finding rows for v1. Add
chunk tables or a RAG component only when the product needs chunked transcripts,
multiple namespaces, importance weighting, surrounding context, or many
embeddings per source.
Creative elements carry operator taste priority directly with `pinned`. The
operator's ingestion note is the taste source; pinned elements are the
note-grounded ingredients that downstream planning should build around. Do not
introduce a separate production-pattern object or ask the operator to manage a
numeric taste weight.

### Search And Retrieval

Retrieval must support three jobs:

```text
search_gallery(query?, tags?, timeframe?, project?, kind?)
  -> saved assets

search_skill_findings(query?, tags?, timeframe?, skill?, kind?)
  -> reusable techniques and skill candidates

create_tasty_pack(goal, timeframe, outputType?, audience?, tags?, count?)
  -> references + ingredients + mix recommendations + generation brief
```

Timeframe is product-critical. The operator should be able to ask for:

- past 24 hours
- past 3 days
- past week
- past month
- custom range
- "latest tasty things for this project"

Audience and customer segmentation should be retrieval-first fields, not a
large tag taxonomy. The v1 facet set is:

- `outputTypes`
- `audiences`
- `ageRanges`
- `industries`
- `customerRoles`
- optional `tastinessScore`

Tags remain lightweight and freeform. Hook, open-loop, pacing, retention, and
similar creative mechanics should stay inside analysis text for v1 because the
main retrieval job is "what did I save recently for this audience or idea,"
not "show me every asset tagged with a specific retention tactic."

### Tasty Packs

A Tasty Pack is not just search results. It is a creative brief generated from
recent taste.

```text
TastyPack {
  request
  captures[] {
    source
    analysis
    elements[] {
      kind
      title
      description
      anchor?
      pinned
    }
  }
  meta
}
```

Pinned elements sort ahead of ordinary context elements so the content
implementation plan can build around them. The production pattern emerges from
the ordered element list instead of a competing stored object.

Creative element kinds include `visual`, `audio`, `hook`, `storyboard`,
`editing`, `copy`, `character`, `format`, and `constraint`. Use `character` for
distinctive personas, guides, archetypes, mascots, or recurring figures such as
"deadpan tech shaman" or "old-school corporate trainer"; pair it with remix
constraints when likeness or IP should not be copied.

Legacy Resource Bank creative elements can be bulk-pinned because pre-pin saved
elements were already curated as important taste. New ingests should only pin
elements grounded in the operator's ingestion note.

Example:

```text
create_tasty_pack(
  goal: "make a reel where Kenji becomes an AI office employee agent",
  timeframe: "past_month",
  outputType: "short_video",
  tags: ["intent:ai-office-agent"]
)
```

Expected output:

- top 5 relevant recent references
- strongest 0-3s hook patterns
- useful middle-retention structures
- visual style recommendations
- sound/editing ideas
- prompt/storyboard for the next generation step

The 0-3s hook and middle-retention structures can be synthesized from
`whyItWorks`, `takeaways`, `frameNotes`, `transcriptText`, and `embeddingText`
on attached analyses. Add a structured timeline only when the UI needs
segment-level rendering or editing.

### Mix And Match

Tasty Packs should decompose sources into ingredient lanes:

```text
source A -> opening hook
source B -> visual background / texture
source C -> pacing / edit rhythm
source D -> caption style
source E -> payoff / CTA / emotional turn
```

The system must recommend combinations at the pattern level, not copy exact
source footage, creator identity, captions, or protected creative expression.

## Labeling Contract

Every ingested source should attempt to fill these labels when evidence allows.

### Source Layer

- `sourceKind`
- platform
- source URL / canonical URL / local path / storage id
- author or attribution status
- duration, dimensions, segment range
- source privacy
- retention note
- extraction status: full, partial, visual-only, transcript-only, metadata-only

### Operator Taste Layer

- original note
- why the operator saved it
- liked element
- future use
- project/task/idea link
- target audience when known
- priority or tastiness score when provided

### Creative Anatomy Layer

- `hook_0_3s`
- `middle_hook`
- payoff / CTA / ending
- storytelling structure
- visual style
- layout/composition
- editing rhythm
- audio / sound cue / music
- caption / typography / on-screen text
- emotional promise
- novelty or trend signal

### Reuse Layer

- reusable levers
- asset recipe
- prompt guess
- skill finding
- remix constraints
- best downstream skill
- confidence and provenance

### Retrieval Tags

Use typed tags:

```text
intent:future-video
intent:self-insert
format:short-form-video
format:caption-bar
style:old-school-corporate
craft:high-contrast-copy
subject:ai-office
audience:founders
retrieval:persona-style-reference
platform:instagram
project:farplane
```

Do not add a first-class tag table until aliases, merge history, usage counts,
or manual curation become real product needs.

## Ranking Model

The first useful ranking formula should be simple and inspectable:

```text
score =
  semantic_similarity(goal, embeddingText)
  + text_match(goal, searchableText)
  + tag_match(filters)
  + recency_boost(timeframe)
  + operator_taste_boost(tastinessScore / explicit note)
  + diversity_boost(pack_coverage)
  - low_confidence_penalty
```

For v1, explicit tags and recency can do most of the work. Embeddings improve
semantic matching but should not hide why an item was chosen.

## RAG Decision

Do not start with full RAG as the product center.

Use:

- Convex indexes for recency/project/task queries.
- Full-text search over asset `searchableText` and skill-finding
  `embeddingText`.
- Vector search over analysis/finding embeddings when embeddings are available.

Add `@convex-dev/rag` or an equivalent chunking layer only when at least one of
these is true:

- long transcripts need chunk-level retrieval
- one asset has many independently retrievable scenes
- retrieval needs surrounding chunks
- importance weighting matters
- namespace separation becomes important
- embedding model migration needs multi-version storage

## UI Requirements

Taste Bank should have four primary views:

- **Inbox**: recent captures and status (`queued`, `analyzing`,
  `needs_review`, `ready`, `failed`).
- **Gallery**: dense browsing with timeframe, platform, format, style,
  project/task, confidence, and extraction-status filters.
- **Asset Detail**: source, user note, analyses, creative ingredients, skill
  findings, tags, provenance, remix constraints, and downstream actions.
- **Tasty Pack Builder**: goal prompt, timeframe, output type, audience, tags,
  count, selected references, ingredient lanes, combined concept, and
  generation brief.

## Agent APIs

The agent-facing API should eventually expose:

```ts
captureTaste(input) -> IngestionJobId;

getTasteAsset(assetId) -> AssetDetail;

searchTaste(input) -> AssetMatch[];

searchCreativeIngredients(input) -> SkillFindingMatch[];

createTastyPack(input) -> TastyPack;

createGenerationBriefFromPack(packId | packInput) -> GenerationBrief;
```

Existing Resource Bank functions are the v1 backing surface; naming can remain
`resourceBank` until the product warrants a module rename.

## Ticket And Task Links

Taste Bank should not own project management. It should remember lightweight
links:

- `projectId`
- `taskId`
- `externalTaskRef`
- idea label
- campaign label

Creating tickets from an ingest note should be a separate action:

```text
capture -> saved reference
saved reference -> optional suggested task
operator approves -> ticket created
```

This keeps capture fast and prevents every bookmark from becoming work.

## Non-Goals

- Do not passively scrape Instagram or the web without explicit operator input.
- Do not promise trend prediction from global internet data in v1.
- Do not copy protected creator identity, source footage, captions, or exact
  edits into generated work.
- Do not require a full RAG system before recency/tag/full-text retrieval is
  proven useful.
- Do not turn every save into a ticket automatically.
- Do not store bulky raw media by default when URL, selected frames, transcript,
  or thumbnail evidence is enough.

## First Slices

### Slice 1: Honest Capture And Retrieval

- Save source URL, note, tags, asset, analysis, and skill findings.
- Support source-read limits and confidence.
- Retrieve by recency, tags, and full-text.
- Fix output type as soft hint, not hard required tag.

### Slice 2: Tasty Pack v1

- Add `createTastyPack` query/action.
- Inputs: goal, timeframe, outputType, audience, tags, project/task, count.
- Output: top references, ingredient lanes, remix constraints, generation brief.
- Start with existing tables and derived response shape; no new tables unless
  saved packs become necessary.

### Slice 3: Capture Surface

- Add UI capture form or share target.
- Show queue state and extraction confidence.
- Let the operator add tags/note quickly.

### Slice 4: Saved Packs And Feedback

- Store generated packs when the operator keeps them.
- Track which references were used.
- Add lightweight feedback: useful, not useful, made content, won, lost.

### Slice 5: Advanced Retrieval

- Add chunked transcripts/scenes and RAG only after pack retrieval exposes real
  recall gaps.
- Add taste scoring and trend/recency weighting after feedback exists.

## Acceptance Criteria

The product is working when the operator can:

1. Save a reel/image/link with a note in under 30 seconds.
2. See it in the Resource/Taste Bank with source, note, tags, and analysis.
3. Ask for "top tasty references from the past week for this idea".
4. Receive a Tasty Pack that includes recent references and extracted creative
   ingredients.
5. Generate a usable brief/storyboard/prompt from that pack.
6. Trace every recommendation back to saved sources and remix constraints.

## Open Questions

- Should the product name in UI be `Resource Bank`, `Taste Bank`, or
  `Tasty Packs`?
- Should tastiness score be explicit, inferred from saves, or both?
- How much authenticated media extraction should Farplane support versus asking
  the operator for exports/screenshots?
- Should generated Tasty Packs be stored as durable records or recomputed from
  current filters until the user saves them?
- Which downstream skill owns final content generation: `video-generation`,
  `video-production`, a new `tasty-pack-generator`, or a project-specific skill?
