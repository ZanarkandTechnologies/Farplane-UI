# Team Workspace Module

## Purpose

Team-level operator surfaces for overview, kanban, timeline, memory,
operator intelligence, and ledger workflows.

Farplane harness, optimization, metrics, and cadence render from the generated
`.farplane/project/ui/latest.json` read model. Tracked project files remain
canonical; the browser does not reinterpret YAML/TOML semantics for these
dashboard surfaces. Tickets remain the work/proof state shown by Kanban.

The required schema-v2 boundary is `tabs.overview.charter`, `tabs.objectives`,
and `metrics.definitions/series`. Charter projects mission, thesis, principles,
non-tradeoffs, and stable capabilities. Objectives projects ordered objectives,
hard guards, freshness-aware readings, and source gaps. The UI has no Goals or
Products navigation/schema and does not fall back to `goals.yaml`.

Overview also derives its autonomy-and-savings presentation from the flat
`metrics.series` cards. It labels potential human-time savings as estimated,
preserves attribution/source gaps, and does not recalculate completed
agent-hours; Harness Usage remains the runtime telemetry owner.

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
- Run workspace typecheck: `npm run typecheck`
