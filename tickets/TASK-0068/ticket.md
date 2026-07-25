---
template_id: ticket-template
template_version: "0.1.3"
feature_refs:
  - FEAT-0003
ticket_id: TASK-0068
title: Make creative elements production-ready across Tasty Packs and Brand Kits
phase: evaluation
status: review
owner: Farplane UI + Farplane
claimed_by: null
priority: high
depends_on:
  - TASK-0057
  - TASK-0061
blocked_by: []
ready: false
approval_required: true
requires_qa: true
requires_demo: true
created_at: 2026-07-22T00:00:00+08:00
updated_at: 2026-07-22T23:55:00+08:00
next_action: Operator evaluates the live six-kind Resource Bank, element inspector, and explicit Brand Kit picker before any provider-funded production run.
last_verification: Strict Convex deploy passed; live audit reports 6 Resource and 6 Brand Kit elements with zero legacy rows; 20 backend and 6 UI tests passed; browser QA and independent TAS-A review passed.
decision_refs:
  - docs/features/FEAT-0003-taste-bank-and-tasty-packs.md
  - tickets/TASK-0057/ticket.md
  - tickets/TASK-0061/ticket.md
  - convex/modules/resourceBank/README.md
  - /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/features/FEAT-0056-inspiration-vault.md
  - /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ingest-content/references/resource-bank-contract.md
  - /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/content-impl-plan/references/production-contract.md
---

# TASK-0068: Make creative elements production-ready across Tasty Packs and Brand Kits

## Summary

Make one lean creative-element contract carry reusable creative intelligence from
ingestion through Resource Bank, Tasty Pack retrieval, Brand Kit approval, content
planning, advisor generation, and Remotion assembly. Each element keeps its existing
kind/title/description plus one explanation of why it works, one golden example
reference, and one golden recipe prompt; no director kind, timing fields, recipe
collections, profile tables, or production-pattern records are added.

This is a new follow-up to completed `TASK-0057` and `TASK-0061`, not a reopening of
their original Brand Kit/UI work. The implementation spans Farplane-UI, which owns
the Convex data/API/UI contract, and the Farplane project, which owns content-system
feature docs and source skill behavior. The two repos must agree before the live
installed skills are refreshed.

## Scope

- `In:`
  - enrich the existing Resource Bank creative-element row with the minimal
    `whyItWorks`, `goldenExample`, and `goldenRecipe` fields
  - enforce six independently reusable production kinds: `format`, `storyboard`,
    `visual`, `character`, `audio`, and `editing`
  - apply the governing test: an element is independently selectable,
    independently conditionable from an example, and owned by a recognizable
    production step
  - fold hooks and semantic copy into storyboard, subtitle rendering/timing into
    editing, and restrictions into production policy or the Brand Kit prompt
  - make Tasty Pack retrieval return complete creative elements without reducing
    them to title/description
  - make Brand Kit promotion snapshot complete creative elements and stable golden
    example locators without depending on live Resource Bank rows
  - update Resource Bank and Brand Kit element presentation to expose image/example,
    description, why it works, and golden recipe without adding new detail tabs
  - document a first-class Farplane Content Production system containing Tasty Pack
    and Brand Kit feature contracts
  - update Farplane source skills so content planning composes Brand Kit identity
    with optional Tasty Pack inspiration, explains why the combination should work,
    produces a low-fidelity review packet and visual storyboard, then realizes each
    chosen element through the appropriate advisor
  - make production ordering dependency-aware, with voice/music/source media chosen
    as the timing master before final visual generation where applicable
  - retire `style_profile` only from the `content-impl-plan` composition contract;
    standalone `video-production` profile ingestion/resolution remains available to
    direct callers outside this Brand Kit + Tasty Pack path
  - reingest the approved Instagram low-poly reference through the new contract and
    prove that its Tasty Pack, Brand Kit snapshot, content plan, generated assets,
    and final render retain element-specific grounding
- `Out:`
  - new creative-element kinds, including `director`, `layout`, or `pacing`
  - `startMs`/`endMs` on creative elements or golden examples; existing asset-level
    media metadata remains available to media tooling
  - a `goldenRecipe` object, required-input list, success-criteria list, production
    hints list, or separate recipe/formula table
  - Brand Kit prompt variants, recipes, per-prompt element membership, inheritance,
    bindings tables, or profile tables
  - saved Tasty Pack rows; Tasty Packs remain computed retrieval results
  - a new generic element-advisor skill or hidden orchestration service
  - deleting `video-production/config.toml`, explainer-style reference files, or
    standalone video-production profile behavior
  - provider credentials, automatic publishing, or unapproved production spend
  - broad Resource Bank redesign outside the compact element grid, inspector, and
    deliberate Brand Kit assignment flow

## Delta

- `Before:` Resource Bank stores source-level analysis beside shallow creative
  elements containing kind/title/description/anchor. Tasty Pack strips elements to
  that shallow shape. Brand Kit promotion copies the description and whole source
  asset, collapses several kinds to `story`, and leaves richer analysis behind.
  Content planning accepts style profiles and Inspiration Packs through parallel
  concepts, orders final audio too late for voice-led production, and can produce a
  render that technically maps element names without being conditioned on their
  actual examples or reproduction prompts.
- `After:` every reusable element carries one compact production capsule:
  `description`, `whyItWorks`, `goldenExample { assetId, description? }`, and
  `goldenRecipe` as a single prompt string. Resource Bank owns candidates, Tasty Pack
  retrieves complete capsules ad hoc, Brand Kit stores approved immutable capsule
  snapshots plus one kit-wide prompt, and content planning composes the two sources
  into an explicit leverage map and dependency-ordered production program.
  Standalone video-production profiles remain a direct video-production capability,
  but are no longer a third reusable creative source in content-impl-plan.
- `Why now:` the low-poly production test showed that the stored source analysis was
  richer than the promoted elements, while the final video used neither element-
  specific visual evidence nor element-specific reproduction prompts. More renders
  on the current contract would repeat that failure.
- `First-principles basis:`
  - objective: every good saved video should become reusable creative intelligence,
    not merely a bookmark or mood description
  - root cause: useful analysis and media exist at source level but are not attached
    to, transported with, or generated from individual creative elements
  - constraint: keep the object small enough to ingest repeatedly and understand in
    one UI card
  - first viable slice: four semantic fields per element, six governed kinds, one
    example, one prompt, no new tables
  - proof/falsification: reingest one known source and generate a plan/render where
    each selected element can be traced to what/why/example/prompt and visible output
  - tradeoff: one example and one prompt cannot represent every future variant, but
    they make the first production loop inspectable without recreating recipe/profile
    sprawl
  - non-goal: automatically infer that a produced video performed well; this ticket
    proves grounding and production use, not audience outcomes

## Change Plan

```text
architecture_signatures:
  module_level:
    - convex/modules/resourceBank / CreativeElement(input): stored candidate capsule
    - convex/modules/resourceBank / createTastyPack(request): computed complete-element pack
    - convex/modules/resourceBank / promoteResourceElementsToBrandKit(input): immutable approved snapshots
    - Farplane docs/systems/content-production.md / content_production(idea, brand_kit?, tasty_pack?): reviewable production program
    - Farplane skills/ingest-content / ingest_content(source, note?, brand_kit_id?): capture + capsules + optional promotion
    - Farplane skills/content-impl-plan / content_impl_plan(idea, brand_kit?, tasty_pack?, context?): creative direction + low-fi review packet + production program
  main_flow:
    - extract_creative_elements(source_evidence, operator_note): CreativeElement[]
    - compose_creative_direction(idea, brand_elements, tasty_elements): leverage_map + hypothesis + storyboard_brief
    - realize_element(element, idea_context): routed advisor packet + artifact/plan + receipt
    - select_timing_master(content_kind, storyboard, selected_elements): voiceover | music | source_video | none
    - assemble_production(locked_storyboard, generated_assets, timing_master): Remotion render + grounding proof
  data_flow:
    - source analysis -> CreativeElement.description/whyItWorks/goldenExample/goldenRecipe
    - Resource Bank CreativeElement -> TastyPack.captures[].elements[] without field loss
    - Resource Bank CreativeElement -> BrandKit.elements[] immutable snapshot + provenance
    - BrandKit.elements[] + TastyPack.elements[] -> content plan leverage map -> advisor inputs -> produced artifacts
    - timing-master asset + alignment/cues -> visual generation durations -> Remotion sequences/captions/mix
  builder_freeform_boundary:
    - Existing module/skill owners may choose local helper names and prompt wording,
      but may not add fields, kinds, tables, compatibility paths, or reorder the
      approved production dependency graph without updating this ticket.
```

### Change 1: Establish the lean canonical creative-element contract

```text
fixes:
  - useful source analysis is stored beside creative elements instead of travelling with them
  - prior proposed whatItIs/recipe metadata duplicated description and prompt concepts
before:
  - Resource Bank elements contain kind, title, description, anchor, pin, tags, and search metadata
  - Brand Kit snapshots use a different kind union and instructions/examples vocabulary
after:
  - the canonical semantic payload is kind, title, description, whyItWorks,
    goldenExample { assetId, description? }, goldenRecipe, pinned, and tags
  - whyItWorks and goldenRecipe are required non-empty strings for new writes
  - goldenExample is one required Resource Bank asset reference plus an optional note
  - provenance, timestamps, embedding data, and project/task links remain storage metadata
  - Brand Kit snapshots preserve the same six kinds and semantic payload; their
    example locator is copied so identity survives Resource Bank reset
read:
  - path: convex/modules/resourceBank/schema.ts
    reason: current Resource Bank and Brand Kit embedded validators
  - path: convex/modules/resourceBank/validators.ts
    reason: current write and snapshot validation
  - path: convex/modules/resourceBank/records.ts
    reason: current public row shaping
  - path: convex/modules/resourceBank/resourceBank.ts
    reason: embedding, hash, kind mapping, and Tasty Pack domain types
write:
  - path: convex/modules/resourceBank/schema.ts
    change: add the three lean semantic fields and align Brand Kit embedded kinds/payload
  - path: convex/modules/resourceBank/validators.ts
    change: validate non-empty whyItWorks/goldenRecipe and one same-job golden example asset
  - path: convex/modules/resourceBank/records.ts
    change: serialize the complete element shape
  - path: convex/modules/resourceBank/resourceBank.ts
    change: include all semantic fields in search text, stable snapshot hash, and shared types; remove lossy kind mapping
  - path: convex/modules/resourceBank/creativeElements.ts
    change: write/update complete capsules and enforce golden example job ownership
operation:
  - preserve description rather than introducing whatItIs
  - represent goldenRecipe as one string, not an object
  - use goldenExample.description for lightweight context such as opening frame,
    voiceover, layout, or the exact quality worth conditioning on
  - keep layout in visual elements, narrative pacing in storyboard, cut rhythm in
    editing, and vocal pacing in audio; do not add director/layout/pacing kinds
signature_or_type_impact:
  - CreativeElement gains whyItWorks: string, goldenExample: { assetId, description? },
    and goldenRecipe: string
  - BrandKitElementSnapshot uses the canonical six kinds and semantic payload while
    retaining approval/provenance/hash fields and stable copied asset locator fields
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - validators reject empty whyItWorks, empty goldenRecipe, missing example asset,
    and example assets from a different ingestion job
  - search/embedding text includes description, whyItWorks, example note, and recipe
  - snapshot hash changes when any semantic field or stable example locator changes
failure_modes:
  - golden example points at a contact sheet from an unrelated source
  - Brand Kit remains tied only to a resettable Resource Bank asset id
  - opening beats or semantic copy are emitted as duplicate pseudo-elements instead
    of one coherent storyboard element
```

### Change 2: Preserve complete elements through Tasty Pack and Brand Kit

```text
fixes:
  - Tasty Pack retrieval strips source analysis needed for element-conditioned production
  - Brand Kit promotion snapshots only description plus the primary source reference
before:
  - createTastyPack maps each element to id/kind/title/description/anchor/pinned/tags
  - promotion always uses the element's primary source asset and ignores a selected derived golden example
after:
  - createTastyPack returns the complete canonical element payload unchanged
  - promotion resolves goldenExample.assetId, copies its stable source/storage locator
    plus example description, and snapshots whyItWorks/goldenRecipe
  - production resolution returns exact kit revision, kit prompt revision, and complete
    approved elements suitable for persistence with generated output
read:
  - path: convex/modules/resourceBank/retrieval.ts
    reason: Tasty Pack hydration and filtering
  - path: convex/modules/resourceBank/brandKits.ts
    reason: promotion, dedupe, and production snapshot owner
  - path: convex/modules/resourceBank/resourceBank.test.ts
    reason: existing pack/hash/promotion helper coverage
write:
  - path: convex/modules/resourceBank/retrieval.ts
    change: hydrate complete element capsules without joining source-level analysis at consumption time
  - path: convex/modules/resourceBank/brandKits.ts
    change: snapshot complete capsules and their selected golden example; preserve one-action ingest promotion
  - path: convex/modules/resourceBank/resourceBank.test.ts
    change: add field-preservation, kind-preservation, example selection, dedupe, and production snapshot tests
operation:
  - createTastyPack(request) remains a query over existing captures; no Tasty Pack table
  - promotion dedupe hashes all semantic fields plus stable example locator
  - ingest_content(source, brand_kit_id) still writes Resource Bank and promotes selected
    note-emphasized elements as one user-visible action
signature_or_type_impact:
  - TastyPackElement becomes the canonical CreativeElement payload plus id
  - getBrandKitForProduction returns the same semantic payload as the approved snapshot
routes:
  docs: update_docs
  qa: tests
  review: reviewer
qa:
  - one element survives Resource Bank write -> Tasty Pack -> Brand Kit -> production query without semantic field loss
  - repeated promotion dedupes exact content but changed recipe/example creates a new revision
  - Resource Bank reset does not remove copied Brand Kit example locator or instructions
failure_modes:
  - retrieval requires consumers to recover why/recipe from source-level analysis
  - promotion snapshots the whole source instead of the selected example asset
  - new fields are absent from idempotency semantics
```

### Change 3: Migrate the small live corpus by snapshot and reingestion

```text
fixes:
  - current rows cannot honestly satisfy required element-level why/example/recipe fields
  - synthetic defaults would preserve shallow data while pretending it is production-ready
before:
  - existing Resource Bank rows and the low-poly Brand Kit use the compact v2 shape
after:
  - migration first deploys a read-tolerant schema with optional new fields while
    add/update mutations require complete fields for all new writes
  - current Resource Bank and Brand Kit state is snapshotted for rollback/debugging
  - keep-worthy sources are reingested through the new contract rather than padded with generic text
  - the low-poly Instagram source is reingested first and its approved elements replace
    the old low-poly kit element set while preserving the stable kit id and one master prompt
read:
  - path: convex/modules/resourceBank/maintenance.ts
    reason: existing guarded snapshot/reset operations
  - path: convex/modules/resourceBank/brandKits.ts
    reason: current stable kit and embedded element revision behavior
write:
  - path: convex/modules/resourceBank/maintenance.ts
    change: add temporary guarded creative-system snapshot, Brand Kit replacement,
      replacement rollback, and legacy-count functions; remove temporary replacement/
      rollback functions after successful final migration proof
  - path: tickets/TASK-0068/artifacts/migration/
    change: local-only snapshot, row counts, reingest receipt, replacement receipt, and rollback notes
operation:
  - stage 1: deploy a widened/read-tolerant schema where the new stored fields are
    optional, while addCreativeElement/updateCreativeElement validators reject new
    incomplete writes
  - stage 2: run `npx convex run modules/resourceBank/maintenance:snapshotCreativeSystem
    '{}' > tickets/TASK-0068/artifacts/migration/before.json`; the new query includes
    jobs, assets, analyses, creative elements, and Brand Kits plus row counts
  - stage 3: record `snapshotCreatedAtMs`, kit revision/prompt revision, old element
    hashes, and expected row counts; do not continue if the artifact is missing/invalid
  - stage 4: run the existing guarded
    `modules/resourceBank/maintenance:resetResourceBankAfterSnapshot` with the exact
    captured counts and timestamp; this clears Resource Bank candidates but leaves
    the independently durable Brand Kit row unchanged
  - stage 5: reingest https://www.instagram.com/p/DTROs7sEWLQ/ using actual media
    analysis and verify every new element has element-specific why/example/recipe
  - stage 6: call temporary guarded
    `modules/resourceBank/maintenance:replaceBrandKitElementsFromIngestionJob` with
    stable kit id, verified ingestion job id, expected kit revision, and confirmation;
    atomically preserve kit id/prompt, replace elements, bump revision, and return the
    complete previous element array in a captured receipt
  - stage 7: if post-replacement verification fails, call temporary guarded
    `modules/resourceBank/maintenance:restoreBrandKitElementsFromMigrationReceipt`
    with the captured previous elements and expected revision, redeploy the tolerant
    schema, and retain the reset Resource Bank snapshot/source list for reingestion
  - stage 8: query `modules/resourceBank/maintenance:countLegacyCreativeElements`,
    require zero shallow rows, then narrow schema validators so the three fields are
    required at storage level
  - stage 9: remove the temporary replacement/restore functions after receipts and
    final production resolution are independently verified
signature_or_type_impact:
  - no permanent legacy parser or optional-field compatibility path
routes:
  docs: update_docs
  qa: qa-tester
  review: reviewer
qa:
  - before/after counts and snapshot paths are recorded
  - tolerant-schema deployment accepts old rows but rejects incomplete new writes
  - stable Brand Kit id and kit prompt survive element replacement
  - Tasty Pack returns the reingested capture and production query returns the replacement snapshots
  - forced rollback restores the captured previous Brand Kit element array and revision
failure_modes:
  - shallow rows are backfilled with one generic why/prompt across every kind
  - current Brand Kit prompt or stable id is lost
  - destructive reset runs without a captured rollback artifact
  - canonical schema is narrowed while any shallow row remains
```

### Change 4: Make Resource Bank and Brand Kit elements inspectable

```text
fixes:
  - operators cannot see whether an element has useful grounding before pinning or approving it
  - Brand Kit examples can appear as repeated whole-source links instead of the selected visual/audio reference
before:
  - element cards emphasize compact descriptions and generic source previews
  - kit detail cannot clearly compare what/why/example/recipe for each approved element
after:
  - Resource Bank Elements remains a dense visual grid with preview, kind, title,
    description, why-it-works, and a compact recipe disclosure
  - Brand Kit gallery still drills into one focused detail page; approved elements
    show selected golden media and the same four semantic fields below the one kit prompt
  - no overview/formula/assets tabs are introduced
read:
  - path: ui/src/modules/resource-bank/elements-workspace.tsx
    reason: current element grid and promotion action
  - path: ui/src/modules/resource-bank/brand-kit-workspace.tsx
    reason: current visual kit gallery/detail
  - path: ui/src/modules/resource-bank/media-preview.tsx
    reason: shared image/video preview behavior
  - path: ui/src/modules/resource-bank/types.ts
    reason: UI contract types
write:
  - path: ui/src/modules/resource-bank/elements-workspace.tsx
    change: render and edit/inspect the complete element capsule without card bloat
  - path: ui/src/modules/resource-bank/brand-kit-workspace.tsx
    change: render approved golden example, why, and recipe in the focused element list
  - path: ui/src/modules/resource-bank/types.ts
    change: align UI types with the canonical payload
  - path: ui/src/modules/resource-bank/brand-kit-workspace.test.ts
    change: cover field rendering, image fallback, one prompt, and absent legacy tabs
operation:
  - use the golden example asset for media preview; fall back to the source only when
    no renderable example locator exists
  - keep recipe collapsed or line-clamped until selected so grids stay scannable
signature_or_type_impact:
  - UI CreativeElement and BrandKitElement types expose the same semantic fields
routes:
  docs: update_docs
  qa: visual-qa
  review: reviewer
qa:
  - desktop and narrow screenshots for Resource Bank element grid, kit grid, and kit detail
  - no nested scrolling, text overlap, blank media, or recipe/profile UI regression
  - browser console and page error logs remain empty
failure_modes:
  - cards become prose-heavy and stop functioning as a visual browser
  - every element displays the same whole-source thumbnail despite distinct examples
  - style-profile or formula controls reappear
```

### Change 5: Document Content Production, Tasty Pack, and Brand Kit in Farplane

```text
fixes:
  - Farplane has a Tasty Pack feature under source-sidecar systems but no content-production system owner
  - Brand Kit has no Farplane feature page despite being a stable cross-skill capability
  - current docs still describe shallow elements and style profiles as parallel production inputs
before:
  - FEAT-0056 owns a minimal inspiration-vault contract under SYS-0008
  - Domain Skill Families mentions content generically
  - Brand Kit truth is split across Farplane-UI docs and skill references
after:
  - new SYS-0012 Content Production owns the reusable flow from idea + Brand Kit +
    optional Tasty Pack through reviewable plan, advisors, Remotion, and proof
  - FEAT-0056 remains the stable Tasty Pack feature id but moves to SYS-0012 and
    documents complete creative elements and ad-hoc trend/taste composition
  - new FEAT-0073 documents Brand Kit as approved durable creative-element snapshots
    plus exactly one kit-wide freeform prompt
  - source-sidecar docs keep ingestion/source ownership but link to Content Production
    for accepted creative reuse
read:
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/features/FEAT-0056-inspiration-vault.md
    reason: existing Tasty Pack feature owner
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/systems/source-sidecar-systems.md
    reason: current FEAT-0056 system owner
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/systems/domain-skill-families.md
    reason: adjacent content/media skill-family boundary
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/features/TEMPLATE.md
    reason: canonical feature shape
write:
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/systems/content-production.md
    change: create SYS-0012 with pipeline, ownership boundaries, composition policy,
      element realization contract, timing-master policy, and proof lifecycle
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/features/FEAT-0056-inspiration-vault.md
    change: update Tasty Pack feature contract and system ownership
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/features/FEAT-0073-brand-kit-approved-creative-identity.md
    change: create first-class Brand Kit feature contract
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/systems/source-sidecar-systems.md
    change: remove FEAT-0056 ownership and name Content Production as the consumer boundary
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/systems/README.md
    change: add Content Production to the system map and current-system table
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/features/registry.jsonl
    change: regenerate from feature pages; do not hand-edit
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/features/registry.md
    change: regenerate from feature pages; do not hand-edit
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/systems/registry.jsonl
    change: regenerate from system docs; do not hand-edit
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/systems/registry.md
    change: regenerate from system docs; do not hand-edit
operation:
  - document Brand Kit and Tasty Pack as separate feature inputs to one content system
  - document Resource Bank as candidate storage, not another production profile
  - explicitly distinguish element goldenRecipe from the single Brand Kit master prompt
signature_or_type_impact:
  - content_production(idea, brand_kit?, tasty_pack?) -> hypothesis + low_fi_review + production_program + proof
routes:
  docs: doc-advisor
  qa: tests
  review: reviewer
qa:
  - feature/system registry validation and documentation reference checks pass
  - FEAT-0056 and FEAT-0073 each belong to exactly SYS-0012
  - generated registries match authored docs
failure_modes:
  - Tasty Pack remains owned by two systems
  - Brand Kit docs recreate profile or recipe collections
  - generated registries are manually edited or stale
```

### Change 6: Make ingest-content produce complete element capsules

```text
fixes:
  - ingestion currently allows shallow creative elements while richer why/prompt/frame analysis remains source-level
  - lightweight inspection can claim reusable elements without a defensible golden example
before:
  - ingest-content stores kind/title/description/anchor/pinned
  - direct media analysis is optional unless reuse/audit already demands it
after:
  - every stored element answers what it is (description), why it works, which one
    asset is the golden example, and the single prompt that recreates its function
  - video ingestion routes through actual media understanding when public metadata and
    notes cannot support element-specific claims
  - source-level analysis remains useful context but is not a substitute for element fields
read:
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ingest-content/SKILL.md
    reason: source skill contract
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ingest-content/references/resource-bank-contract.md
    reason: canonical write/retrieval shape
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ingest-content/references/phase-router.md
    reason: source-reading depth decisions
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ingest-content/references/reuse-taxonomy.md
    reason: kind semantics
write:
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ingest-content/SKILL.md
    change: require complete capsules, honest evidence depth, and one-action Brand Kit promotion
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ingest-content/references/resource-bank-contract.md
    change: replace compact v2 element shape with the lean production-ready shape
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ingest-content/references/phase-router.md
    change: route video understanding when element-specific example/why/prompt cannot be grounded
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ingest-content/references/reuse-taxonomy.md
    change: enforce the six-kind governing test and folding rules
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ingest-content/qa_checklist.md
    change: gate every written element on complete capsule fields and resolvable example asset
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ingest-content/evals/evals.json
    change: add low-poly and shallow-metadata hardcases
operation:
  - derive element prompts from observed mechanics, not generic style adjectives
  - use a derived image/contact sheet/audio/transcript asset when it is the clearest
    example; otherwise use the primary source asset with a precise example description
  - keep explicit ingest-to-brand-kit one action with no required UI cleanup
signature_or_type_impact:
  - ingest_content returns saved_capture + complete creative_elements + retrieval_handle + optional promotion_receipt
routes:
  docs: update_docs
  qa: agent-qa-test
  review: reviewer
qa:
  - eval rejects elements missing why, example, or recipe
  - eval rejects identical generic recipe text copied across unrelated kinds
  - live reingest verifies storage and Tasty Pack retrieval
failure_modes:
  - agent invents media details it did not inspect
  - every element selects the same unhelpful whole-source example
  - recipe simply restates the description without making generation conditional
```

### Change 7: Compose Brand Kit and Tasty Pack inside content-impl-plan

```text
fixes:
  - style profile, Inspiration Pack, and Brand Kit can appear as competing abstractions
  - plans map element names but do not require generation to condition on example and recipe
  - low-fidelity concept, visual storyboard, and why-this-will-work reasoning are not one explicit approval packet
before:
  - content_impl_plan accepts style_profile? and inspiration_pack?
  - reference leverage maps use shallow elements and classify readiness mostly by media refs
after:
  - content_impl_plan accepts brand_kit? and tasty_pack? as the two reusable creative inputs
  - Brand Kit supplies approved identity/constraints; Tasty Pack supplies optional ad-hoc
    current taste/trends; the idea and invocation constraints remain the task brief
  - Brand Kit constraints win, compatible Tasty elements augment by role, and conflicts
    are selected/rejected explicitly rather than silently blended
  - each selected element maps to a beat, planned artifact, advisor action, or production rule
  - the approval packet includes creative hypothesis, why the combination should work,
    rejected/conflicting elements, low-fidelity demo, visual storyboard with notes,
    and exact element leverage map before final generation
  - direct callers may still use standalone video-production style profiles, but
    content-impl-plan does not accept or merge them as a third creative source
read:
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/content-impl-plan/SKILL.md
    reason: parent planning and action ordering
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/content-impl-plan/references/production-contract.md
    reason: creative lock and ticket contract
write:
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/content-impl-plan/SKILL.md
    change: replace this skill's style-profile input lane with Brand Kit + optional Tasty Pack composition,
      complete-element leverage, review packet, and timing-master dependency order
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/content-impl-plan/references/production-contract.md
    change: define composition precedence, element realization packet, creative lock,
      low-fi/visual-storyboard approval, and audio-first timing cases
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/content-impl-plan/qa_checklist.md
    change: require complete selected elements, visible reference use, and dependency proof
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/content-impl-plan/evals/evals.json
    change: add Brand Kit only, Tasty Pack only, composed, conflict, and low-poly regression cases
operation:
  - compose_elements(brandKit, tastyPack, idea) produces an explicit chosen/rejected map
  - realize_element(element, idea_context) routes goldenRecipe + goldenExample +
    description/why to the existing owner advisor; no new universal advisor is created
  - a complete element may produce narrative text, an asset, an audio track, or an
    edit rule rather than pretending every kind generates a file
signature_or_type_impact:
  - content_impl_plan(idea, content_kind?, video_method?, brand_kit?, tasty_pack?,
    icp?, platform?, proof?, constraints?, artifact_owner?)
  - element_realization_packet = { element, ideaContext, targetRole, acceptanceNote }
routes:
  docs: update_docs
  qa: agent-qa-test
  review: reviewer
qa:
  - Brand Kit-only plan preserves every selected identity element and kit policy
  - composed plan names provenance and rejects a Tasty element that conflicts with kit constraints
  - plan cannot pass creative_lock when selected example/recipe is ignored by its advisor packet
  - low-poly regression packet contains actual visual storyboard images and notes before spend
failure_modes:
  - style profile survives as a third reusable creative source inside content-impl-plan
  - Tasty trends override approved Brand Kit identity silently
  - plan includes a why-it-works paragraph but no observable mapping to generated output
```

### Change 8: Route element-conditioned work through existing production skills

```text
fixes:
  - child skills accept references inconsistently and may drop why/example/recipe context
  - a single fixed storyboard -> assets -> generation -> audio order is wrong for voice-led or music-led work
before:
  - storyboard/video/asset/audio/image/video/avatar/Remotion skills receive mixed reference prose and shallow element maps
  - content-impl-plan currently places audio after generation/capture
after:
  - each existing owner accepts the standard element realization packet relevant to its domain
  - format/storyboard inform story and delivery shape; visual/character inform
    assets/image/video/avatar; audio informs audio-advisor; editing informs Remotion
  - the plan selects voiceover, music, source_video, or none as timing master
  - for voice-led explainers/avatar/lipsync: lock script -> generate voice/timestamps ->
    revise cue sheet/storyboard -> generate visual clips with safe surplus -> Remotion
  - for music-led edits: select/generate approved music first; for source-video-led
    work, inspect/capture source duration first; all paths converge on Remotion
read:
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/storyboard/SKILL.md
    reason: narrative and visual storyboard owner
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/video-production/SKILL.md
    reason: video method and production routing
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/asset-advisor/SKILL.md
    reason: reference-to-asset decisions
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/audio-advisor/SKILL.md
    reason: timing-master audio generation and receipts
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ai-image-advisor/SKILL.md
    reason: visual golden-example conditioning
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ai-video-advisor/SKILL.md
    reason: visual/video golden-example conditioning
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/avatar-advisor/SKILL.md
    reason: character/voice continuity
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/remotion/SKILL.md
    reason: deterministic terminal assembly
write:
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/storyboard/SKILL.md
    change: consume story-facing element capsules and emit low-fi visual storyboard/notes tied to element ids
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/video-production/SKILL.md
    change: consume compiled creative direction when called by content-impl-plan;
      preserve standalone profile ingestion/resolution for direct video-production callers
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/asset-advisor/SKILL.md
    change: map golden examples and recipes to concrete reuse/regenerate/generate decisions
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/audio-advisor/SKILL.md
    change: support timing-master output with actual duration/alignment/cue receipt
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ai-image-advisor/SKILL.md
    change: require element prompt plus golden example when an element conditions generation
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/ai-video-advisor/SKILL.md
    change: require element prompt plus golden example and audio-derived target duration/handles
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/avatar-advisor/SKILL.md
    change: preserve character/audio element conditioning and timing master
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/remotion/SKILL.md
    change: require actual timing-master media, cue sheet, element leverage receipts,
      captions/subtitles, transitions, mix, and final grounding check
operation:
  - update only each skill's signature/todos/QA references needed to preserve the packet;
    do not duplicate the entire composition policy in every child skill
  - leave `skills/video-production/config.toml`, profile references, and standalone
    profile evals in place; add a composed-direction case rather than deleting that owner
  - add focused eval or QA fixture to each materially changed skill; shared contract
    assertions may live in content-impl-plan tests when child behavior is routing-only
signature_or_type_impact:
  - advisor calls receive element_realization_packet where applicable
  - production program records timingMaster and actual duration/cue evidence
routes:
  docs: update_docs
  qa: agent-qa-test
  review: reviewer
qa:
  - contract scan confirms every relevant child either consumes or explicitly rejects each element kind
  - voice-led regression generates timing audio before final video prompts and uses alignment for subtitles/cues
  - Remotion proof maps accepted assets and final scenes back to chosen element ids
failure_modes:
  - every child skill copies the full composition policy and drifts
  - visual generation starts before voice duration is known in a voice-led plan
  - Remotion adds generic transitions/subtitles that conflict with selected editing/format elements
```

### Change 9: Sync source skills and prove the complete low-poly lifecycle

```text
fixes:
  - installed ~/.codex skill copies can drift from Farplane source
  - unit tests cannot prove that a produced video actually uses selected creative elements
before:
  - the low-poly source exists in Resource Bank/Brand Kit, but the rejected render was weakly grounded
after:
  - Farplane source skills pass maintenance checks and are installed through the existing sync path
  - a fresh content plan, visual storyboard, timing-master audio, generated visuals/clips,
    Remotion render, and review receipt demonstrate element-conditioned use
read:
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/skill-maintenance/SKILL.md
    reason: canonical source validation and install route
  - path: /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills/skill-maintenance/scripts/install_selected_skills.py
    reason: installed-copy refresh owner
write:
  - path: tickets/TASK-0068/artifacts/content-proof/
    change: local-only plan, leverage map, storyboard images/notes, audio/alignment,
      generation receipts, media probes, final MP4/still, and review/QA reports
operation:
  - validate Farplane source skills before installation
  - install only the changed source skills through the repo-owned maintenance path
  - invoke content-impl-plan with the low-poly Brand Kit and reingested Tasty Pack
  - require operator approval of the low-fi visual storyboard before provider spend
  - generate timing-master audio before final video, then stitch and review
signature_or_type_impact:
  - none beyond the source skill signatures already defined
routes:
  docs: update_docs
  qa: qa-tester + visual-qa + agent-qa-test
  review: reviewer
qa:
  - source and installed skill files match after sync
  - live proof includes element-by-element planned use and visible/audible final evidence
  - final review rejects renderability-only proof or generic low-poly resemblance
failure_modes:
  - implementation patches ~/.codex directly instead of Farplane source
  - live run incurs provider spend before the operator approves the review packet
  - final render cannot show which golden examples/recipes influenced which outputs
```

## Done

```text
done_when:
  - canonical Resource Bank, Tasty Pack, Brand Kit, and production packet types preserve the lean creative-element payload without field or kind loss
  - every stored CreativeElement passes the three-part governing test and uses only
    format, storyboard, visual, character, audio, or editing
  - every new ingest element contains non-empty description, whyItWorks, goldenRecipe,
    and one same-source goldenExample asset plus optional description
  - Brand Kit remains one embedded approved snapshot array plus exactly one kit-wide prompt
  - Tasty Pack remains computed and can mix complete recent elements with Brand Kit elements
  - Farplane contains SYS-0012 Content Production, updated FEAT-0056 Tasty Pack,
    and new FEAT-0073 Brand Kit with valid generated registries
  - content-impl-plan composes Brand Kit + optional Tasty Pack, emits hypothesis,
    conflict decisions, low-fi review packet, visual storyboard/notes, leverage map,
    timing master, advisor actions, and proof contract
  - child skill handoffs condition relevant work on the selected element's golden
    recipe and example instead of only its title/description
  - voice-led production generates and measures speech before final visual clips and
    Remotion uses actual audio/caption cues
  - the low-poly Instagram source is reingested and replaces the old shallow kit
    snapshots while preserving the stable kit id and master prompt
  - Resource Bank cards open a scrollable element inspector and Add to Brand Kit
    requires an explicit destination-kit confirmation
  - promoting an unchanged source element is a no-op while promoting a changed
    version replaces its existing kit snapshot rather than appending a duplicate
  - an approved low-poly proof render visibly/audibly maps every claimed reused element
    to final output; generic resemblance or renderability alone is insufficient
  - all automated, browser, agent-behavior, visual, audio, migration, documentation,
    and independent reviewer gates pass
```

## QA Strategy

```text
qa_strategy:
  proof_weight: demo
  metrics: none mechanical for creative quality; use contract preservation counts,
    element leverage coverage, media probes, and independent visual/audio judgment
  critical_path:
    - source -> ingest-content -> Resource Bank complete element capsules
    - Resource Bank -> computed Tasty Pack complete elements
    - selected elements -> immutable Brand Kit snapshots + one kit prompt
    - idea + Brand Kit + Tasty Pack -> content plan + low-fi visual review packet
    - approved plan -> timing-master audio -> aligned visual generation -> Remotion
    - final render -> element grounding review + artifact snapshot receipt
  checks:
    - Convex resourceBank focused tests and Convex typecheck
    - root build/typecheck and focused UI tests/lint
    - Farplane skill maintenance validator and changed skill eval suites
    - Farplane feature/system registry generation and validation
    - documentation reference validator
    - source-to-installed skill parity check after approved sync
  ordered_sanity_checks:
    - write/read one complete element and reject invalid example ownership
    - retrieve the same complete element through Tasty Pack
    - promote it and resolve the same semantic payload through Brand Kit production query
    - inspect element and kit detail UI at desktop/narrow widths
    - run ingest-content behavior eval against shallow-source and low-poly fixtures
    - run content-impl-plan evals for kit-only, pack-only, composed, and conflict cases
    - inspect generated low-fi storyboard files and element leverage map before spend
    - generate/probe timing-master audio and alignment before final visual generation
    - probe generated clips and final Remotion composition
    - independently review the final MP4/still against selected element examples/recipes
  manual:
    - verify Resource Bank cards remain visual/scannable and expose why/example/recipe
    - verify Brand Kit is still grid -> focused detail with one prompt and no recipe/profile tabs
    - verify low-poly final output expresses the selected format, storyboard, visual,
      character, audio, and editing elements actually claimed
  delegated_lanes:
    - qa-tester for live Convex migration/reingest/retrieval lifecycle
    - agent-qa-test for ingest and content-planning skill behavior
    - visual-qa for Resource Bank UI, storyboard grids, and final render
    - reviewer for implementation, architecture, evidence quality, and completion claim
  review:
    - rubric: implementation-plan + architecture + evidence-quality during planning;
        implementation + visual-quality + evidence-quality at completion
      required_tas: TAS-A
  human_gates:
    - operator approves this ticket before goal-advisor/implementation
    - operator approves low-fidelity demo and visual storyboard before provider spend
    - destructive/reset migration requires verified snapshot artifact first
  evidence:
    - tickets/TASK-0068/artifacts/migration/
    - tickets/TASK-0068/artifacts/qa/
    - tickets/TASK-0068/artifacts/content-proof/
    - tickets/TASK-0068/artifacts/review/
  grounding_evidence:
    - local Farplane-UI schema/retrieval/promotion code and implemented TASK-0057/TASK-0061
    - local Farplane source skill contracts and FEAT-0056
    - official Remotion Sequence/audio/captions documentation for frame-timed assembly
    - official ElevenLabs timestamp/alignment documentation for audio-led cue timing
  goal_advisor_inputs:
    proof_route: focused tests -> contract/eval QA -> migration/reingest QA -> browser
      and storyboard visual QA -> approved production run -> final render/audio QA -> TAS-A review
    final_evidence: complete-element roundtrip receipt, registry validation, best UI
      screenshots, approved storyboard images, audio/alignment receipt, final MP4/still,
      leverage map, and independent review
    final_checkpoint: reviewer confirms the stored contract, skills, live low-poly
      lifecycle, and final artifact prove element-conditioned production rather than
      shallow naming or generic resemblance
  residual_risk:
    - one golden example and one prompt may be insufficient for unusually broad elements;
      add multiplicity only after real repeated failures
    - Instagram/source accessibility can change; retain honest extraction limits and
      local derived evidence used by the verified reingest
    - provider output remains stochastic; approval and acceptance checks constrain but
      cannot eliminate regeneration

Final report: include the best screenshot/image evidence as
![best evidence](ABSOLUTE_SCREENSHOT_PATH), or block/revise with the missing
proof reason.
```

## Agent Contract

- `Launch:` run `corepack pnpm run ui` from Farplane-UI, open the printed URL at
  `/office`, then open the registry-backed `Resource Bank` launcher.
- `Backend state:` connect the intended Convex deployment before testing populated
  states. Use the guarded migration sequence in Change 3; do not seed demo rows into
  the live migration deployment.
- `Stable navigation:` dialog name `Resource Bank`; counted tabs `Assets`, `Elements`,
  and `Brand Kits`; element kind controls use the six canonical kind labels; kit cards
  open the focused detail page; detail exposes `Back`, one production prompt textarea,
  and the approved element grid.
- `Required test hooks:` add narrowly scoped `data-testid` values only where roles and
  labels cannot distinguish the selected golden example, why-it-works disclosure,
  golden-recipe disclosure, or approved element card. Do not add broad selector markup.
- `Key states:` Resource Bank loading/error/empty; populated visual Elements grid;
  element without renderable preview fallback; Brand Kit gallery; selected kit detail;
  prompt save; complete approved element cards; compact element grid; selected-element
  inspector; explicit kit picker; unchanged promotion no-op; changed snapshot replace;
  desktop and narrow viewport.
- `Stabilization:` wait for the Resource Bank dialog, Convex loading states to clear,
  media previews to settle, and zero page/console errors before capture. Record the
  selected kit id/revision and capture ids in the evidence note.
- `QA cookbook:` start at `qa/README.md` and the office cookbook; add a Resource Bank
  cookbook page only if the implemented flow cannot be reproduced reliably from the
  existing office entrypoint and this contract.
- `Expected screenshots:` Assets/Elements/Brand Kits first viewport, populated element
  grid, Brand Kit gallery, selected kit detail with one prompt and image-backed complete
  elements, narrow selected-kit detail, low-fidelity storyboard overview, best final
  render still.
- `Expected non-image evidence:` browser error log, migration receipts, Tasty Pack and
  production resolver summaries, skill eval receipts, audio/alignment receipt, media
  probes, final MP4 path, and independent review.

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - docs/features/FEAT-0003-taste-bank-and-tasty-packs.md
    - convex/modules/resourceBank/README.md
    - ui/src/modules/resource-bank/README.md
    - docs/HISTORY.md after verified implementation
    - /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/systems/content-production.md
    - /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/features/FEAT-0056-inspiration-vault.md
    - /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/features/FEAT-0073-brand-kit-approved-creative-identity.md
    - /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/systems/source-sidecar-systems.md
    - affected Farplane skill packages, references, QA checklists, and evals named above
  no_docs_reason:
  validation:
    - Farplane feature/system registry generation and validation
    - Farplane doc reference validation
    - Farplane skill maintenance validation
    - docs and implementation contracts use the same fields, kinds, ownership, and production order
```

## Links

- `program:` `tickets/TASK-0068/program.md`
- `progress:` `tickets/TASK-0068/progress.md`
- `goal prompt:` `tickets/TASK-0068/generated-goal-prompt.md`
- `visual companion:` `tickets/TASK-0068/diagrams.md`
- `artifacts:` `tickets/TASK-0068/artifacts/`
- `review:` `tickets/TASK-0068/artifacts/review/2026-07-22-plan-review-2.md` (`TAS-A`, pass)
- `browser qa:` `tickets/TASK-0068/artifacts/qa/browser-qa.md` (`pass`, after server restart)
- `browser qa receipt:` `tickets/TASK-0068/artifacts/qa/result.json`
- `browser qa best evidence:` `tickets/TASK-0068/artifacts/qa/screens/desktop-element-inspector.png`
- `element gallery density proof:` `tickets/TASK-0068/artifacts/qa/screens/desktop-six-kind-grid.png`
- `mobile inspector proof:` `tickets/TASK-0068/artifacts/qa/screens/mobile-element-inspector.png`
- `explicit kit picker proof:` `tickets/TASK-0068/artifacts/qa/screens/desktop-brand-kit-picker.png`
- `six-kind migration receipt:` `tickets/TASK-0068/artifacts/migration/six-kind-consolidation-receipt.md`
- `six-kind live readback:` `tickets/TASK-0068/artifacts/migration/six-kind-after.json`
- `before/after evaluation:` `tickets/TASK-0068/artifacts/evaluation/before-after.md`
- `dry-run content plan:` `tickets/TASK-0068/artifacts/content-proof/dry-run-content-plan.md`
- `dry-run storyboard:` `tickets/TASK-0068/artifacts/content-proof/dry-run-storyboard.png`
- `implementation review:` `tickets/TASK-0068/artifacts/review/2026-07-22-implementation-review.md` (`TAS-A`, pass)
- `six-kind correction review:` `tickets/TASK-0068/artifacts/review/2026-07-22-six-kind-correction-review.md` (`TAS-A`, pass)
- `refs:` `TASK-0057`, `TASK-0061`, `FEAT-0003`, Farplane `FEAT-0056`

## Notes

- `Minimal implementation claim:` this is the smallest complete implementation
  because it adds three semantic fields to the existing element row, narrows to six
  governed kinds, and reuses existing asset rows, Tasty Pack query, embedded snapshots,
  existing advisor skills, and existing Remotion terminal path. It adds no runtime
  table, generic advisor, recipe collection, or timing schema.
- `Accepted vocabulary:` description says what the element is; whyItWorks says why it
  succeeded; goldenExample is one asset plus optional note; goldenRecipe is one prompt
  string. Brand Kit prompt is a separate kit-wide freeform instruction.
- `Style-profile decision:` recommended removal from this content path because Brand
  Kit is the durable reusable identity input and Tasty Pack is the ad-hoc inspiration
  input. Approval removes `style_profile` from `content-impl-plan` and updates its
  callers rather than preserving a third compatibility lane there; direct standalone
  `video-production` profile behavior remains supported and separately owned.
- `Blast radius:` Convex schema and live data, Resource Bank UI, Tasty Pack API, Brand
  Kit production packets, feature/system docs, and the affected Farplane source skill
  packages and contract references.
- `Risks / rollback:` the widened-schema migration window had an explicit replacement
  rollback. After the strict cutover passed, its temporary functions were removed and
  the historical receipt was superseded by `artifacts/migration/finalization-receipt.md`.
  Restoring incomplete legacy rows now requires a new operator-approved conversion;
  do not add a permanent fallback.
- `Grounding:` local implementation and maintained source skill contracts, plus
  official Remotion sequencing/caption/audio docs and ElevenLabs timestamp/alignment
  docs. No peer product parity research is required because the operator-defined
  creative model and existing Farplane ownership are the controlling contract.
- `Planning validator:` `farplane validate ticket tickets/TASK-0068/ticket.md
  --phase planning --root <Farplane-UI>` was attempted after the companion was
  generated. The command cannot run because Farplane-UI does not ship
  `rules/validation.toml`; validating against the Farplane repo root is also invalid
  because this ticket is outside that root. Independent TAS-A review treats this as
  an explicit repository infrastructure limitation, not a ticket-contract failure.
- `Follow-ups:` multiple golden examples, saved Tasty Packs, performance feedback,
  automatic trend retrieval, and per-element outcome scoring require separate evidence
  and tickets.

```text
plan_qa:
  minimal_required_version: pass
  reuse_before_new_surface: pass
  least_parameters: pass
  new_files_functions_justified: pass - only one system doc and one first-class Brand Kit feature page are new durable owners
  minimal_impl_plan_claim: pass
  existing_service_fit: pass
  goal_advisor_ready: pass after operator approval
  clarifying_questions: pass - style-profile retirement is explicit in the approval decision
  architecture_signatures: pass
  change_plan_signature_linkage: pass
  change_plan_locality: pass
  qa_strategy_explicit: pass
  docs_strategy: pass
  independent_plan_review: pass - TAS-A
  visual_companion_boundary: pass
  visual_companion_colored_delta: pass
  grounding_evidence: pass
  highest_risk: cross-repo contract drift or a live migration that fabricates rich fields instead of reingesting evidence
  fix_or_deferral: atomic ticket, source-first skill edits, snapshot/reingest proof, and final element-conditioned content demo
```

```text
visual_companion:
  path: tickets/TASK-0068/diagrams.md
  template: skills/impl-plan/references/visual-companion-template.md
  generated_by: delegated diagramming lane
  blocks_approval: false
  canonical_contract: ticket.md
```
