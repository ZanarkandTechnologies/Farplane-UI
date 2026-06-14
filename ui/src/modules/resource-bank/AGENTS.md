# Resource Bank UI Module

This module owns Farplane's operator surface for saved media references,
analysis records, and extracted skill findings.

## Rules

- Keep the first viewport usable: search, clusters, cards, and selected detail.
- Show extracted skill findings beside media references; do not render only a raw media wall.
- Treat task/project links as lightweight filters and labels.
- Use shared UI primitives and theme tokens.

## Test

- `npm run ui:typecheck`
- Browser QA for empty and populated Resource Bank states.
