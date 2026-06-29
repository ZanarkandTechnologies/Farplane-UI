---
ticket_id: TASK-0011
goal_shape: active_goal
created_at: 2026-06-25T01:03:22+0800
owner: Codex
status: complete
---

# Goal Program: Team Panel Goals Campaign Prototype

## Objective
Implement and verify the first `Goals` tab prototype for the Team Panel as a
game-inspired but source-honest campaign surface for tracking autonomous agents.

## Slice Boundary
- `In:` `GoalsTab` UI, ticket alignment, Goal Packet files, focused checks, and
  one browser screenshot.
- `Out:` full seven-tab collapse, new persistence model for completed goals,
  goal mutation workflows, backend endpoints, and broad tab IA migration.

## Metric
Pass when:
- `Goals` displays an active quest, campaign map, side objectives, progress, and
  trophy shelf using current project/task/KPI/memory data.
- Completed task trophies stay visible and are labeled as task-backed evidence,
  not as completed goal records.
- Future/unplanned nodes render as locked or source-missing instead of fake
  certainty.
- Type/build or targeted checks pass, or failures are documented with cause.
- Browser evidence shows the rendered tab in `/office`.

## Loop
1. Read ticket, relevant module docs, and current `GoalsTab`.
2. Update ticket/packet state.
3. Implement the smallest honest prototype.
4. Run focused checks.
5. Capture browser evidence.
6. Update progress and close the native Goal only after proof is recorded.

## Evidence Targets
- `npm run test:once -- team-panel`
- `npm run ui:build`
- `git diff --check -- ui/src/modules/team-workspace tickets/TASK-0011`
- Screenshot: `.farplane/proof/TASK-0011-goals-campaign-tab.png`

## Result
Completed on 2026-06-25. The first `Goals` campaign prototype is implemented
and verified. Broader tab collapse remains outside this Goal and should wait for
operator taste feedback on the prototype.

## Drift Guard
Do not collapse the whole Team Panel tab row during this Goal. This run exists
to make the `Goals` tab tangible so the operator can give taste feedback before
the broader cockpit migration.
