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
`constraint`.

Do not store frame, clip, transcript, or audio evidence as first-class Tasty Pack
output by default. Extract the value into creative elements, with an optional
`anchor` such as `0-3s`, `opening frame`, `caption`, or `voiceover`. Add
separate retained evidence only when a future workflow needs direct media reuse,
debugging, rights review, or audit proof.

Tasty Pack retrieval filters primary assets by timeframe plus retrieval facets
(`audiences`, `industries`, `ageRanges`, `customerRoles`, `outputTypes`, and
optional `tastinessScore`), then hydrates attached analyses and creative
elements.

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
