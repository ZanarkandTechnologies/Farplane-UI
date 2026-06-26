# Resource Bank

Resource Bank stores explicitly ingested media references and the skill-facing
knowledge extracted from them.

Core model:

```text
ingestion job -> primary asset -> analyses -> skill findings
              -> derived assets such as clips, frames, transcripts, thumbnails
```

The gallery search lane searches assets and analyses. The skill search lane
searches extracted skill findings, such as existing skills to reuse, candidate
skills to create, or specific techniques to apply later.

Tasty Pack retrieval is the operator-facing pack lane. It filters primary
assets by timeframe plus retrieval facets (`audiences`, `industries`,
`ageRanges`, `customerRoles`, `outputTypes`, and optional `tastinessScore`),
then uses attached analyses for hook, retention, remix, and prompt reasoning.
Do not model hook/retention mechanics as a managed performance-tag taxonomy in
v1; keep those as rich analysis text unless a later UI needs timeline-specific
fields.

Embeddings live on `resourceBankAnalyses` and `resourceBankSkillFindings` for
v1. That keeps retrieval close to the record it explains. Move to
`@convex-dev/rag` only when the vault needs chunking, namespaces, importance
weighting, or surrounding-chunk context.

Function files are split by resource domain first:

- `jobs.ts`: ingestion job lifecycle and task links.
- `assets.ts`: asset writes, asset detail, gallery search, and asset similarity.
- `analyses.ts`: reusable analysis writes.
- `skillFindings.ts`: extracted skill knowledge writes and search.
- `retrieval.ts`: dashboard and agent-facing retrieval packets.
- `demo.ts`: local QA seed data.
- `records.ts`: shared row shaping and parent lookups.

Only split a domain file further by Convex function type when it becomes large
enough that `queries.ts`, `mutations.ts`, or `actions.ts` would improve local
navigation.
