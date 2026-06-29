---
ticket_id: TASK-0033
program_id: goal-task-0033-team-workspace-tab-refactor
status: active
created_at: 2026-06-29
updated_at: 2026-06-29
---

# Goal Program: TASK-0033 Team Workspace Tab Refactor

## Files

- `tickets/TASK-0033/ticket.md`
- `tickets/TASK-0033/program.md`
- `tickets/TASK-0033/progress.md`
- `tickets/TASK-0033/goal.md`
- `AGENTS.md`
- `PROJECT_RULES.md`
- `ui/src/modules/team-workspace/AGENTS.md`
- `ui/src/modules/team-workspace/README.md`
- `ui/src/modules/team-workspace/index.ts`
- `ui/src/modules/team-workspace/components/team-panel.tsx`
- `ui/src/modules/team-workspace/components/farplane-project-config.tsx`
- `ui/src/modules/team-workspace/components/overview-tab.tsx`
- `ui/src/modules/team-workspace/components/overview-tab.helpers.ts`
- `ui/src/modules/team-workspace/components/overview-tab.helpers.test.ts`
- `ui/src/modules/team-workspace/components/operator-intelligence-tabs.tsx`
- `ui/src/modules/team-workspace/components/task-detail-modal.tsx`
- `ui/src/modules/team-workspace/components/kanban-tab.tsx`
- `ui/src/modules/team-workspace/components/timeline-tab.tsx`
- `ui/src/modules/team-workspace/components/team-panel-types.ts`

## Loop Shape

`active_goal`: one focused implementation and proof window.

## Metric

Hybrid:
- mechanical: focused Team Workspace tests, Biome, root typecheck, and filtered
  UI typecheck output
- structural: largest Team Workspace tab hotspots are split into folderized
  internal modules without generic utilities or public API churn
- visual: browser smoke evidence that Team Panel tabs still render, including
  Timeline Configure Hooks
- review: inline maintainability check against ticket and project module rules;
  use delegated reviewer if final diff is broad or risky

## Budget

- Time: one focused local pass
- Model/compute: local shared
- Subagents: optional for final review or visual QA only
- Spend: none
- External services: none beyond existing local UI runtime

## Drift Policy

Before completion, compare the diff against the ticket:
- Team Workspace stays the owning product module; no new top-level tab modules.
- No behavior changes to tab ids, TeamPanel props, data loading, store keys, or
  hook telemetry configuration.
- No unrelated `thread-data-panel.tsx` cleanup or revert.
- No generic catch-all utility files.
- Keep helpers module-local until a real second caller exists.
- Preserve the current Timeline tab behavior and Configure Hooks button.

## Execution Order

1. Lock current behavior by reading Team Workspace docs, current imports, and
   focused tests.
2. Split project config code first because it has the highest smell score.
3. Split Overview into avatar preview, cards, and helper logic.
4. Split Operator Intelligence by exported tab and shared quest UI.
5. Extract Task Detail Modal helpers only if clearly behavior-preserving.
6. Update README/export/import paths.
7. Run focused checks and browser smoke.
8. Update `ticket.md` and `progress.md` with evidence, residual risk, and final
   review decision.

## Completion Checkpoint

Update `progress.md` and `ticket.md` with:
- files changed
- line-count/structure delta for major hotspots
- commands/checks run
- browser screenshot path or explicit blocker
- grounding line, with local-only reason if no external docs were needed
- residual risk
