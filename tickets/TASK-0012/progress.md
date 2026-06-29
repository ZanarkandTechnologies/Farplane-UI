---
ticket_id: TASK-0012
kind: goal-progress
status: done
created_at: 2026-06-25
updated_at: 2026-06-25
---

# TASK-0012 Progress

## 2026-06-25

- Created Goal Packet for rollout/template dashboard implementation.
- Grounded scope in Harness OS module docs, Farplane harness maintenance docs,
  current payload types, existing rollout/template panels, and Recharts/shared
  chart primitives.
- Next: implement panel charts and run verification.

## 2026-06-25 Closeout

- Implemented Rollout as a project adoption dashboard:
  scorecards for spec/latest pins/clean projects/manifests, a stacked project
  template adoption chart, and project debt rows.
- Implemented Template Tracking as the template migration cockpit:
  latest-adoption scorecards, family version distribution, rollout debt
  leaderboard, skill heat x maintenance priority scatter, policy note, family
  rows, and skill worklist.
- Extended Harness graph node typing for optional skill heat, eval, checklist,
  UI, tier, and source fields used by the priority chart.
- Connected `TemplateTrackingSurface` to graph data so skill heat can inform
  maintenance priority.
- Verification passed:
  - `npm run typecheck:root`
  - `npm run ui:build`
  - targeted `biome lint` on touched Harness files
  - `git diff --check`
  - `curl -I /template-rollout` and `curl -I /rollout`
  - Playwright screenshot pass with no console/page errors
- Evidence:
  - `tickets/TASK-0012/artifacts/template-rollout-dashboard.png`
  - `tickets/TASK-0012/artifacts/rollout-dashboard.png`
- Known residual context:
  - `npm run ui:typecheck` still fails on pre-existing unrelated workspace UI
    type debt; no errors from the modified Harness files were observed.
  - Historical trend charts remain out of scope until scan snapshots are
    persisted.
