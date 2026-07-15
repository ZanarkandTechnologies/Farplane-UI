# Resource Bank Contract

## Source Of Truth

Use the Farplane UI Resource Bank module as the backing store unless the
operator supplies another vault:

- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/convex/modules/resourceBank/AGENTS.md`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/convex/modules/resourceBank/schema.ts`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/convex/modules/resourceBank/validators.ts`
- `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/docs/specs/FP03-taste-bank-and-tasty-packs.md`

## Current Tables

- `resourceBankIngestionJobs`: one explicit capture request, source, note,
  scope, tags, status, and project/task links.
- `resourceBankAssets`: retained source references and derived evidence assets.
  Primary assets carry retrieval facets for Tasty Packs.
  Browser-displayable previews for URL/video/social sources should be stored as
  derived `thumbnail`, `frame`, or `evidence` image assets with `storageId`,
  `localPath`, or a direct image URL.
- `resourceBankAnalyses`: source-backed and inferred breakdowns, including
  why-it-works, hook/retention notes, takeaways, prompt guesses, remix
  constraints, confidence, and embedding text.
- `resourceBankCreativeElements`: reusable production ingredients extracted
  from the source. Valid kinds are `visual`, `audio`, `hook`, `storyboard`,
  `editing`, `copy`, `character`, `format`, and `constraint`. `character`
  covers distinctive personas, archetypes, guides, hosts, mascots, or recurring
  figures that carry the creative premise without copying protected identity.
  `pinned` marks elements grounded in the operator's ingestion note; downstream
  content planning should focus more on these elements.
- `resourceBankSkillFindings`: reusable techniques, existing-skill matches,
  skill updates, and skill candidates extracted from a source.

## Retrieval Fields

Use first-class asset fields only for things the operator will filter, group, or
pack by:

- `outputTypes`: examples `reel`, `short-video`, `landing-page`, `thumbnail`.
- `audiences`: examples `founders`, `operators`, `students`, `creators`.
- `ageRanges`: examples `18-24`, `25-34`, `35-44`.
- `industries`: examples `ai`, `saas`, `education`, `finance`.
- `customerRoles`: examples `founder`, `marketer`, `engineer`, `buyer`.
- `tastinessScore`: optional 0-1-ish operator or agent confidence that this is
  a high-value reference.

Keep `tags` lightweight and freeform for style, subject, project, and recall.
Do not create managed tag families for hook/open-loop/pacing/retention unless a
later UI or query path proves the need.

## Analysis Shape

For video/social content, write the attention game into analysis text:

```text
First 0-3s hook:
- What happens immediately?
- Why would the target viewer keep watching for three seconds?
- What reusable move can be remixed?

Retention beats:
- What changes after the hook?
- What curiosity, visual change, story beat, proof, or escalation earns the
  next few seconds?
- What should a future creator borrow at the pattern level?
```

Store these details in `whyItWorks`, `takeaways`, `frameNotes`, `promptGuess`,
`remixConstraints`, and `embeddingText`.

## Write Sequence

1. Create the capture job:
   `modules/resourceBank/jobs:createIngestionJob`.
2. Add the primary retained asset:
   `modules/resourceBank/assets:addResourceAsset`.
3. For any visual, video, or social primary asset that is not itself a direct
   image URL or uploaded file, add a derived preview asset when available:
   - use `npm run resource-bank:upload-thumbnail -- --job-id <jobId>
     --parent-asset-id <assetId> --file <image>` for a local thumbnail, frame,
     screenshot, or contact sheet;
   - set `assetRole` to `thumbnail` for the best card preview, or `evidence`
     for supporting frame/contact-sheet proof;
   - if source access is blocked, store that fact in the primary asset
     `retentionNote` and tag it `limited-source-read`.
4. Add one or more analyses:
   `modules/resourceBank/analyses:addResourceAnalysis`.
5. Add creative elements:
   `modules/resourceBank/creativeElements:addCreativeElement`.
6. Add optional skill findings:
   `modules/resourceBank/skillFindings:addSkillFinding`.
7. Query `modules/resourceBank/assets:getResourceAsset` to verify the asset and
   attached records.
8. Query `modules/resourceBank/retrieval:createTastyPack` with the likely
   timeframe and facets to verify future pack retrieval.

Preview verification is part of storage verification for visual/social/video
captures:

```text
if primary asset is visual/social/video:
  pass when derivedAssets contains a browser-displayable thumbnail/frame/contact sheet
  pass with limitation when retentionNote explains the source blocked preview extraction
  fail when neither preview evidence nor limitation is present
```

## Convex Function Map

```text
createIngestionJob({
  sourceKind,
  sourceRef,
  originalInstruction?,
  note?,
  requestedFocus?,
  sourceScope?,
  tags?,
  projectId?,
  taskId?,
  externalTaskRef?,
  requestedBy?,
  sourcePrivacy?
}) -> jobId

addResourceAsset({
  jobId,
  parentAssetId?,
  assetRole,
  assetKind,
  title,
  sourceUrl?,
  canonicalUrl?,
  storageId?,
  localPath?,
  mimeType?,
  width?,
  height?,
  durationMs?,
  startMs?,
  endMs?,
  platform?,
  author?,
  attributionStatus?,
  outputTypes?,
  audiences?,
  ageRanges?,
  industries?,
  customerRoles?,
  tastinessScore?,
  tags?,
  searchableText?,
  retentionNote?
}) -> assetId

addResourceAnalysis({
  jobId,
  assetId,
  analysisType,
  sourceSkill: "ingest-content",
  facts?,
  interpretation?,
  userIntent?,
  whyItWorks?,
  takeaways?,
  transcriptText?,
  frameNotes?,
  promptGuess?,
  remixConstraints?,
  confidence?,
  embeddingText?,
  embeddingModel?,
  embedding?,
  tags?
}) -> analysisId

addSkillFinding({
  jobId,
  assetId,
  analysisId,
  findingKind,
  skillId?,
  skillPath?,
  label,
  capability,
  evidenceAnchor,
  howToReuse,
  suggestedSkillChange?,
  tags?,
  confidence?,
  embeddingText?,
  embeddingModel?,
  embedding?
}) -> findingId

addCreativeElement({
  jobId,
  assetId,
  analysisId?,
  kind,
  title,
  description,
  anchor?,
  pinned?,
  embeddingText?,
  embedding?,
  tags?
}) -> creativeElementId

createTastyPack({
  idea?,
  timeframe?,
  startAtMs?,
  endAtMs?,
  tags?,
  outputType?,
  outputTypes?,
  audience?,
  audiences?,
  ageRanges?,
  industry?,
  industries?,
  customerRole?,
  customerRoles?,
  projectId?,
  taskId?,
  limit?
}) -> TastyPack
```

For character/persona elements, prefer fields like:

```text
kind: "character"
title: "Deadpan legacy-office guide"
description: "A dry corporate-training host makes the AI product premise feel familiar."
anchor: "opening host / recurring narrator"
pinned: true only when the note explicitly liked that host/persona
embeddingText: "deadpan old-school corporate guide character for AI office advert"
tags: ["character:corporate-guide", "persona:deadpan-host"]
```

## Source Kind Mapping

- `url`: generic link, webpage, profile, or social URL.
- `image`: photo, design still, visual reference.
- `video`: video file or video URL.
- `audio`: audio source.
- `file`: PDF, document, deck, downloaded file, unknown attachment.
- `note`: idea with no external source.
- `screenshot`: screenshot supplied as the source.
- `clip`: selected segment from a longer video/audio source.

## Asset Kind Mapping

- `url`: retained source URL.
- `image`: uploaded image or image URL.
- `video`: retained video source or upload.
- `audio`: retained audio source or upload.
- `file`: generic retained file.
- `note`: note-only asset.
- `screenshot`: screenshot evidence.
- `clip`: selected video/audio range.
- `frame`: selected video frame.
- `transcript`: transcript text or transcript file.

## Segment And Element Mapping

For notes like "the first few seconds are nice" or "I like the image used at
the start," save:

- the whole source as the primary asset;
- the highlighted range through `sourceScope`, asset `startMs`/`endMs`, or a
  derived `clip`/`frame`/`screenshot` asset when available;
- the reusable idea as analysis `takeaways`;
- the hook/retention logic in `whyItWorks`, `frameNotes`, and `embeddingText`;
- the generation recipe as `promptGuess`;
- attribution and remix boundaries as `remixConstraints`;
- note-backed reusable ingredients as creative elements, with `pinned=true`
  only for elements the operator explicitly liked or selected;
- distinctive hosts, guides, mascots, or archetypes as `kind="character"` when
  the persona is a reusable creative ingredient;
- retrieval facets for audience/output/industry/customer filters.

When a character/persona is tied to a real performer, copyrighted character,
brand mascot, or recognizable public identity, store a rights-safe remix
constraint such as "reuse the guide archetype, dry delivery, and role contrast;
do not copy the person's likeness, name, catchphrases, voice, or exact costume."
When the operator note praises the character directly, pin the `character`
element. When the character is merely visible but not part of the stated taste,
leave it unpinned and keep it as context.

## Verification Standard

Storage is not done until Resource Bank returns:

- the job and primary asset with expected source, title, status, tags, and
  retrieval facets;
- at least one retained asset or an explicit note-only reason;
- for visual/social/video captures, either a derived preview/evidence asset or a
  source-access blocker in `retentionNote`;
- at least one analysis from `ingest-content`;
- at least one creative element for creative/video/social inspiration sources;
- optional skill findings only when evidence supports them;
- a Tasty Pack query that can find the asset by timeframe and supplied facets,
  preserving `analysis.operatorNote`, element `pinned`, and direct pack
  warnings when a note produced no pinned elements.

If the Convex deployment cannot be found, a function is missing, upload fails,
or the query does not return the expected row, report the exact blocker and
keep the analysis packet in chat or a ticket-scoped artifact.
