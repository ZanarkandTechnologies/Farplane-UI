# Video Intelligence UI Module

This module owns durable YouTube ingest records, dossiers, story comparisons,
and their read projections. The public Office surface is the
`content-intelligence` module, which consumes its detail hooks; do not add a
second Video Intelligence launcher or date-pager workflow.

## Rules

- Keep canonical video, dossier, story, claim, and tag state in Convex. The loopback bridge is only a trusted write client.
- Read the panel projection directly through Convex React; do not add a filesystem or Vite proxy mirror.
- Show existing Resource Bank YouTube assets as source-honest legacy dossiers until structured Video Intelligence analysis exists.
- Treat claims without evidence as visibly uncited; never manufacture timestamps.
- Derive the story comparison from structured contributions, never parsed Markdown.
- Keep video dossier/story context local. Content Intelligence owns its shared
  panel tabs, continuous chronological feed, and panel-open state.
- Treat Story as one time-bounded event and Tag as a stable reusable lens.
- Render `contributes` only from StoryContribution and `related` only from persisted StoryRelation. Never relabel either as citation, causality, correction, or derivation.
- Keep information flow read-only and defer tag governance/editable graphs.

## Test

- Focused model tests.
- `pnpm run ui:typecheck`
- Browser QA through Content Intelligence for end-of-feed date loading, dossier,
  story, Back-context, mobile, empty, loading, failed, and unavailable states.
