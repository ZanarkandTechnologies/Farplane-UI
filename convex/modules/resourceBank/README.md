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

Embeddings live on `resourceBankAnalyses` and `resourceBankSkillFindings` for
v1. That keeps retrieval close to the record it explains. Move to
`@convex-dev/rag` only when the vault needs chunking, namespaces, importance
weighting, or surrounding-chunk context.

Function files are split by role:

- `mutations.ts`: ingestion job, asset, analysis, and skill-finding writes.
- `queries.ts`: gallery search, dashboard, asset detail, and retrieval packet.
- `actions.ts`: vector search, because Convex vector search runs from actions.
- `demo.ts`: local QA seed data.
- `records.ts`: shared row shaping and parent lookups.
