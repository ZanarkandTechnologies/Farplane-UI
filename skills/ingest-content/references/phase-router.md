# Phase Router

Use this reference when deciding which subskill or storage shape owns each
phase of `ingest_content(source, note?)`.

## Core Function

```text
ingest_content(source, note?)
  -> read_content(source, note?)
  -> breakdown_content(evidence, note?)
  -> extract_usefulness(breakdown, note?)
  -> store_content(source, evidence, usefulness, note?)
```

Each phase may choose a different specialist. The skill should behave like a
router with a shared output contract, not a single monolithic analyzer.

## Note Intent

Parse the note before extraction:

- `save_reference`: "save this", "I like this", "for future reference".
- `segment_focus`: "first few seconds", "this background", "this shot",
  "the image used here", "the caption style".
- `future_creation`: "make a video like this later", "use this for a landing
  page", "make my own version".
- `generate_now`: "make me my own", "create a similar image", "turn this into
  assets now".
- `project_memory`: a project, client, campaign, or personal context tag.

The note should influence:

- what part of the source is inspected;
- which elements are extracted;
- which retrieval facets and tags are added;
- whether generation recipes are stored or generation skills are called now.

## Read Phase

```text
read_content(source, note?) -> evidence_bundle
```

Routes:

- URL/article/webpage/PDF/transcript: `summarize` or direct local read.
- Social/video/audio: `media-ingest` for source identity, transcript status,
  representative frames, and retention note.
- Video segment requested by note: `media-ingest` first, then
  `video-understanding` over selected frames/transcript section.
- Image/screenshot: direct visual inspection; optionally store original or
  screenshot as an asset.
- Plain idea: create note-only evidence with source kind `note`.

Evidence must mark confidence:

- `source-backed`
- `frame-backed`
- `transcript-backed`
- `visual-only`
- `note-backed`
- `inferred`

## Breakdown Phase

```text
breakdown_content(evidence, note?) -> source_facts + taste_analysis
```

Breakdown variants:

- `summary`: what the source is and what is visible.
- `visual`: composition, typography, color, layout, asset choices, focal point.
- `video`: first 0-3s hook, retention beats, pacing, shot structure, segment
  timing, editing pattern.
- `copy`: caption, headline, claim, CTA, on-screen text, meme wording.
- `style`: mood, texture, genre, cultural pattern, audience signal.
- `prompt`: likely generation/editing prompt or recreation instructions.

Do not flatten everything into one summary. If the note highlights one part,
analyze that part first, then add a one-line whole-source context summary.

## Usefulness Phase

```text
extract_usefulness(breakdown, note?) -> reusable_elements[]
```

Reusable element candidates:

- `style`: visual style, lighting, texture, design language, editing style.
- `layout`: grid, overlay, composition, hierarchy, caption placement.
- `segment`: time range, selected frame set, scene, quote, or audio moment.
- `asset`: background image, cutout, thumbnail, frame, transcript, prompt.
- `pattern`: hook, meme structure, before/after, contrast, pacing.
- `recipe`: steps to regenerate something similar.
- `constraint`: attribution, avoid-copying note, remix boundary.

Element record shape:

```text
ReusableElement = {
  kind,
  label,
  why_useful,
  evidence_anchor,
  generation_recipe?,
  tags,
  confidence,
  remix_constraints
}
```

If the operator asks to generate now, route the generation step after storage
or save the extracted recipe first so the vault remains the durable memory.

## Store Phase

```text
store_content(source, evidence, usefulness, note?) -> jobId + assetId + retrieval_proof
```

Current Resource Bank storage can represent elements through:

- `resourceBankIngestionJobs`: one source/request with note, source scope,
  status, tags, and project/task links.
- `resourceBankAssets`: source URL, original file, screenshot, frame,
  transcript, clip, and retrieval facets for Tasty Packs.
- `resourceBankAnalyses`: facts, interpretation, why-it-works,
  hook/retention notes, takeaways, prompt guess, remix constraints, confidence,
  and embedding text.
- `resourceBankCreativeElements`: first-class reusable visual, audio, hook,
  storyboard, editing, copy, format, and constraint elements. Pin only the
  elements grounded in the operator note so downstream content planning can
  focus more on them.
- `resourceBankSkillFindings`: reusable techniques, skill updates, existing
  skill matches, and skill candidates.

Future richer storage should add first-class records for:

- segments: time ranges, selected frames, clip labels, transcript spans.
- richer timeline records: only when segment-level rendering or editing needs
  first-class retention beats.
- `@convex-dev/rag` or chunk tables: only when large transcripts/documents need
  chunked retrieval, namespaces, importance weighting, or surrounding context.

Write reusable element records into `resourceBankCreativeElements`; keep
supporting context in `analyses.takeaways`, `frameNotes`, `promptGuess`,
`remixConstraints`, skill findings, and lightweight tags. Keep
customer/audience/output retrieval in asset facets rather than tags.
