# Resource Bank Convex Module

This module owns Farplane's searchable media inspiration bank.

## Rules

- Keep the v1 schema compact: jobs, assets, analyses, and skill findings.
- Store embeddings on the same analysis/finding rows they retrieve; do not add a separate embedding table until chunking or multi-model retrieval requires it.
- `embedding` vectors are 1536 dimensions for v1.
- Treat raw media as retained references: source URL, local path, storage ID, thumbnail, clip, frame, transcript, or retention note.
- Keep task/Notion/project links lightweight. This module can remember `projectId`, `taskId`, and `externalTaskRef`, but it does not own external task sync.

## Test

- `npx tsc -p convex/tsconfig.json --noEmit`
- `npm run test:once -- convex/modules/resourceBank/resourceBank.test.ts`
