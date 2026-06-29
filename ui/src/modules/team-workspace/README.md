# Team Workspace Module

## Purpose

Team-level operator surfaces for overview, kanban, timeline, memory,
operator intelligence, and ledger workflows.

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
