# Team Workspace Module

## Purpose

Team-level operator surfaces for overview, kanban, timeline, memory,
operator intelligence, and ledger workflows.

Kanban also owns the first-project business foundation gate. When active
filesystem tickets carry `foundation_step` metadata, it shows only those
tickets and their three-step progress (`find_customer`, `deliver_value`, then
`collect_revenue`). Normal board visibility returns only after every foundation
ticket is closed; the UI never starts automation as part of that unlock.

Farplane harness, optimization, metrics, and cadence render from the generated
`.farplane/project/ui/latest.json` read model. Tracked project files remain
canonical; the browser does not reinterpret YAML/TOML semantics for these
dashboard surfaces. Tickets remain the work/proof state shown by Kanban.

The required schema-v3 boundary is `tabs.overview.charter`, `tabs.objectives`,
and `metrics.definitions/series`. Every metric series card consumes Core's
typed `current`, `comparison`, `cumulative`, and raw `series` views; the UI
does not derive momentum from adjacent observations. Charter projects mission, thesis, principles,
non-tradeoffs, and stable capabilities. Objectives projects ordered objectives,
hard guards, freshness-aware readings, and source gaps. The UI has no Goals or
Products navigation/schema and does not fall back to `goals.yaml`.

Overview also derives its autonomy-and-savings presentation from the flat
`metrics.series` cards. It labels potential human-time savings as estimated,
preserves attribution/source gaps, and does not recalculate completed
agent-hours; Harness Usage remains the runtime telemetry owner.

The dedicated Wins and Failures tabs read optional win and failure cards from
`tabs.highlights` in the same project snapshot. Core derives the display fields
from the append-only Interval highlight ledgers; the UI filters with one
project-local team-slug adapter and never reads report prose or remote task
state for this surface. Wins emphasize exceptional verified metric movement.
Failures admit one Daily card per calendar day, lead with the reusable lesson
as the “Failure of the day,” and retain what happened and the
evidence links. Both tabs use full responsive galleries. Local evidence opens
through the project-scoped, read-only `/farplane/project-file` bridge rather
than a `file://` URL.

The Failures gallery groups those canonical Daily cards by Monday-based week.
It does not add votes, ranking, promotion state, or a duplicate weekly
highlight.

## Public API / Entrypoints

- `index.ts`
- `components/team-panel.tsx`
- Tab shell compatibility exports under `components/`
- Focused tab implementations under `components/tabs/`
- Shared types in `components/team-panel-types.ts`

## Minimal Example

```tsx
<TeamPanel teamId="team-proj-farplane-dev-team" isOpen onOpenChange={() => {}} />
```

## How To Test

- Run targeted Team Panel tests: `npm run test:once -- team-panel`
- Run focused highlight tests:
  `corepack pnpm vitest run ui/src/modules/team-workspace/lib/dashboard-projections/project-ui-snapshot.test.ts ui/src/modules/team-workspace/lib/dashboard-projections/overview-summary-surface.test.ts ui/src/modules/team-workspace/components/tabs/highlights/highlights-gallery-tab.test.ts ui/vite-bridge/project-file.test.ts`
- Run workspace typecheck: `npm run typecheck`
