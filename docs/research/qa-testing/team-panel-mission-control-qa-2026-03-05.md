# Team Panel Mission Control QA (2026-03-05)

## Scope

- Team panel mission-control redesign in `ui/src/features/team-system/components/team-panel.tsx`
- Internal-only Kanban board controls
- Slack-like communications feed layout
- CLI command/permission expansions for team + board operations

## Expected UI Spec

1. Tabs use full available panel height (`flex-1 min-h-0` pattern).
2. Overview shows mission hierarchy + KPI strip + improved roster cards.
3. Projects tab renders gallery cards (Notion-like grouping by project).
4. Communications tab resembles internal Slack channel layout.
5. Business tab keeps all telemetry but with clearer grouped information architecture.
6. Kanban no longer exposes federation selector/canonical/manual-resync controls in this phase.

## Observed Validation

### Code-Level UI Validation

- Verified tab shell and tab content wrappers now use full-height semantics:
  - `DialogContent` uses flex column layout.
  - `Tabs` container uses `min-h-0 flex-1`.
  - Each `TabsContent` uses `min-h-0 flex-1 overflow-hidden`.
- Verified Overview now contains:
  - Mission brief card with status badges.
  - 4-card KPI strip (Members/Open Tickets/Queue Pressure/Profit Pulse).
  - Upgraded mission crew roster cards.
- Verified Projects now renders gallery cards over all projects with KPI badges and pulse metrics.
- Verified Communications now renders:
  - channel/filter rail,
  - message stream with agent/type/time rows,
  - internal-ops footer guidance.
- Verified Kanban provider/canonical/manual-resync controls are removed from panel UX for this phase.

### Browser Validation

- Browser automation reached `/office`, but interactive 3D/canvas controls were unlabeled in accessibility snapshot, so deterministic scripted opening of specific Team Panel contexts was not reliable.
- Supplemental validation was completed via component-level code inspection and targeted regressions/tests below.

## Regression + Functional Checks

- `pnpm vitest cli/team-commands.test.ts convex/board_contract.test.ts` -> pass
- `pnpm tsc --noEmit` -> pass
- Updated/verified CLI commands:
  - `team show`
  - `team kpi set|clear`
  - `team business set-all`
  - `team board task update|delete`
- Permission-denial path verified in tests using restricted `SHELLCORP_ALLOWED_PERMISSIONS`.

## Result

- PASS (code + test regression checks)
- Browser visual navigation to exact panel state remains partially blocked by current office canvas accessibility exposure; no functional regressions detected in updated surfaces.
