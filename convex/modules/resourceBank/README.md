# Resource Bank

Resource Bank stores explicitly ingested media references and the skill-facing
knowledge extracted from them.

Core model:

```text
ingestion job -> primary asset -> analysis summary -> creative elements
                                      -> optional skill findings
                                      -> optional Brand Kit promotion
```

The active Tasty Pack contract is intentionally minimal. It returns captures:
source metadata, compact analysis, and extracted creative elements. Creative
elements are the production-use components the operator may want later:
`visual`, `audio`, `hook`, `storyboard`, `editing`, `copy`, `character`,
`format`, and `constraint`. `character` covers distinctive hosts, guides,
personas, archetypes, mascots, or recurring figures that carry the creative
premise without copying protected identity. Creative elements also carry
operator taste priority directly:
`pinned` means the element is grounded in the operator's ingestion `note` and
should drive downstream planning. Do not add a separate production-pattern record
for this; the usable pattern emerges from the ordered element list.

The canonical reusable creative element payload is:

```text
{
  kind
  title
  description
  whyItWorks
  goldenExample { assetId, description? }
  goldenRecipe
  anchor?
  pinned
  tags
}
```

`whyItWorks` and `goldenRecipe` are required non-empty strings on new writes.
`goldenExample.assetId` must point at an asset from the same ingestion job as the
element. Storage is temporarily widened for the live TASK-0068 migration, but
the add/update mutations reject incomplete new rows.

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

`retrieval:createTastyPack` returns complete elements inside
`captures[].elements[]`:

```text
{
  id?
  kind
  title
  description
  whyItWorks
  goldenExample { assetId, description? }
  goldenRecipe
  anchor?
  pinned
  tags
}
```

`creativeElements:listCreativeElements` returns each canonical creative element
plus source metadata and a hydrated golden example asset:

```text
{
  _id
  ingestionJobId
  assetId
  analysisId?
  kind
  title
  description
  whyItWorks
  goldenExample { assetId, description? }
  goldenExampleAsset?: {
    _id
    ingestionJobId
    parentAssetId?
    title
    assetKind
    assetRole
    sourceUrl?
    canonicalUrl?
    storageId?
    storageUrl: string | null
    localPath?
    durationMs?
    startMs?
    endMs?
    tags
    projectId?
    taskId?
    createdAtMs
    updatedAtMs
  }
  goldenRecipe
  anchor?
  pinned
  tags
  assetTitle?
  assetKind?
  assetSourceUrl?
  assetCanonicalUrl?
  previewAsset?
}
```

Existing creative element rows can be normalized with:

```bash
npx convex run modules/resourceBank/maintenance:backfillCreativeElementPins \
  '{"confirm":"backfill-creative-element-pins"}'
```

The one-time pin backfill treated the preexisting curated corpus as important
saved taste. New ingests should only pin elements when the operator's ingestion
note explicitly says that ingredient matters.

Brand Kits are the approved durable identity layer above Resource Bank. Resource
Bank creative elements remain observed inspiration/candidates; Brand Kit
elements are stable snapshots embedded on a `brandKits` row with provenance back
to the source asset, ingestion job, and creative element. Do not make a Brand Kit
depend on live Resource Bank element ids only, because Resource Bank may be
edited, reset, or reingested while approved creative identity must remain stable.

V1 keeps Brand Kit elements and the single Brand Kit prompt embedded on the kit
row instead of adding separate tables. The expected kit size is small, a single
revisioned row gives atomic create/update/archive/promotion behavior, and
production skills can resolve one immutable packet through
`brandKits:getBrandKitForProduction`. Split elements into their own rows only
when kit element counts, collaboration, per-element audit history, or cross-kit
reuse make the embedded row materially hard to operate.

Brand Kit element snapshots use the same nine kinds as Resource Bank creative
elements. Each snapshot copies `description`, `whyItWorks`, `goldenRecipe`, and
a stable displayable `goldenExample` locator:

```text
goldenExample {
  assetId?
  sourceUrl?
  canonicalUrl?
  storageId?
  localPath?
  title?
  description?
  storageUrl?   // read queries only
}
```

Stored Brand Kit snapshots keep the locator fields but not `storageUrl`.
`brandKits:listBrandKits`, `brandKits:getBrandKit`, and
`brandKits:getBrandKitForProduction` hydrate `goldenExample.storageUrl` from
Convex storage when `storageId` is present.

A Brand Kit has exactly one freeform prompt object:

```text
prompt {
  text
  revision
  updatedAtMs
}
```

The prompt may include non-secret provider hints, subtitle styling, voice
direction, format, seed, aspect ratio, and constraints. Runtime credentials
remain in the owning secret resolver. Prompt writes use
`brandKits:updateBrandKitPrompt` with optimistic kit and prompt revision checks;
each accepted prompt write bumps both the prompt revision and kit revision.

Production handoff is `brandKits:getBrandKitForProduction`. It requires an
active kit and returns an immutable snapshot containing the exact kit revision,
the prompt snapshot, and the full approved element set. Downstream production
tools should save that packet with generated output.

The 2026-07-21 migration collapsed the former recipe/formula fields into the
single prompt and removed those fields from the canonical schema. New writes
must never recreate parallel prompt collections or per-prompt element links.

The ingest handoff is `brandKits:promoteIngestionJobToBrandKit`: skills create a
normal Resource Bank job with optional stable `brandKitId`, write assets and
creative elements, then call the promotion mutation once. It promotes explicit
element ids when supplied, otherwise pinned job elements only. If no emphasized
elements are identified, it returns an empty receipt instead of approving every
candidate. That preserves the one user-visible ingest action without making the
UI depend on external skill internals.

Promotion dedupe hashes approved content plus stable source URLs, not resettable
Resource Bank row or storage IDs. Optional idempotency keys are stored only as
non-secret hashes tied to the content snapshot, so exact retries dedupe while a
meaningfully changed approved instruction creates a new revision.

TASK-0068 used a guarded snapshot, reset, reingest, and atomic Brand Kit
replacement. The migration completed before the schema became strict; its
receipts live under `tickets/TASK-0068/artifacts/migration/`. The durable
maintenance checks remain available:

```bash
npx convex run modules/resourceBank/maintenance:snapshotCreativeSystem \
  '{}'

npx convex run modules/resourceBank/maintenance:countLegacyCreativeElements '{}'
```

`countLegacyCreativeElements` should remain at zero. The reset mutation is
retained for future operator-approved reingests, but must always follow a saved
snapshot and matching row-count confirmation. The temporary replacement and
rollback mutations were removed after their receipts and production snapshot
proved the migrated Brand Kit.

Embeddings live on `resourceBankAnalyses`, `resourceBankSkillFindings`, and
`resourceBankCreativeElements`. Move to `@convex-dev/rag` only when the vault
needs chunking, namespaces, importance weighting, or surrounding-chunk context.

Function files are split by resource domain first:

- `jobs.ts`: ingestion job lifecycle and task links.
- `assets.ts`: asset writes, asset detail, gallery search, and asset similarity.
- `analyses.ts`: reusable analysis writes.
- `creativeElements.ts`: extracted production components for Tasty Packs.
- `brandKits.ts`: approved Brand Kit CRUD, Resource Bank promotion, and
  production snapshot resolution.
- `skillFindings.ts`: extracted skill knowledge writes and search.
- `retrieval.ts`: dashboard and agent-facing retrieval packets.
- `maintenance.ts`: guarded snapshot/reset for reset-and-reingest migrations.
- `demo.ts`: local QA seed data.
- `records.ts`: shared row shaping and parent lookups.

Only split a domain file further by Convex function type when it becomes large
enough that `queries.ts`, `mutations.ts`, or `actions.ts` would improve local
navigation.
