# Resource Bank

Resource Bank stores explicitly ingested media references and the skill-facing
knowledge extracted from them.

Core model:

```text
ingestion job -> primary asset -> analysis summary -> creative elements
                                      -> optional skill findings
```

The active Tasty Pack contract is intentionally minimal. It returns captures:
source metadata, compact analysis, and extracted creative elements. Creative
elements are the production-use components the operator may want later:
`visual`, `audio`, `hook`, `storyboard`, `editing`, `copy`, `format`, and
`constraint`. Creative elements also carry operator taste priority directly:
`pinned` means the element is grounded in the operator's ingestion `note` and
should drive downstream planning. Do not add a separate production-pattern record
for this; the usable pattern emerges from the ordered element list.

Do not store frame, clip, transcript, or audio evidence as first-class Tasty Pack
output by default. Extract the value into creative elements, with an optional
`anchor` such as `0-3s`, `opening frame`, `caption`, or `voiceover`. Add
separate retained evidence only when a future workflow needs direct media reuse,
debugging, rights review, or audit proof.

Preview thumbnails/contact sheets should be stored as derived Resource Bank
assets with `storageId` pointing at Convex file storage. The ingest path can
upload a local generated image and insert the derived row with:

```bash
npm run resource-bank:upload-thumbnail -- \
  --job-id <resourceBankIngestionJobs id> \
  --parent-asset-id <primary resourceBankAssets id> \
  --file /path/to/contact_sheet.jpg \
  --title "Contact sheet: source title" \
  --source-url https://source.example/item \
  --tag frame-backed
```

The dashboard query resolves stored thumbnails to `storageUrl` with
`ctx.storage.getUrl`, and the panel renders that URL before falling back to
direct image URLs or local dev paths.

Tasty Pack retrieval filters primary assets by timeframe plus retrieval facets
(`audiences`, `industries`, `ageRanges`, `customerRoles`, `outputTypes`, and
optional `tastinessScore`), then hydrates attached analyses and creative
elements. Pack elements are ordered by pinned status and recency so content
planning can simply focus more on the operator-stated taste components.

Existing creative element rows can be normalized with:

```bash
npx convex run modules/resourceBank/maintenance:backfillCreativeElementPins \
  '{"confirm":"backfill-creative-element-pins"}'
```

The legacy migration pins all existing creative elements because the current
corpus was already curated as important saved taste. New ingests should only pin
elements when the operator's ingestion note explicitly says that ingredient
matters.

Embeddings live on `resourceBankAnalyses`, `resourceBankSkillFindings`, and
`resourceBankCreativeElements`. Move to `@convex-dev/rag` only when the vault
needs chunking, namespaces, importance weighting, or surrounding-chunk context.

Function files are split by resource domain first:

- `jobs.ts`: ingestion job lifecycle and task links.
- `assets.ts`: asset writes, asset detail, gallery search, and asset similarity.
- `analyses.ts`: reusable analysis writes.
- `creativeElements.ts`: extracted production components for Tasty Packs.
- `skillFindings.ts`: extracted skill knowledge writes and search.
- `retrieval.ts`: dashboard and agent-facing retrieval packets.
- `maintenance.ts`: guarded snapshot/reset for reset-and-reingest migrations.
- `demo.ts`: local QA seed data.
- `records.ts`: shared row shaping and parent lookups.

Only split a domain file further by Convex function type when it becomes large
enough that `queries.ts`, `mutations.ts`, or `actions.ts` would improve local
navigation.
