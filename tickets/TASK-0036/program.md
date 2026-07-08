---
kind: goal-program
ticket_id: TASK-0036
status: active
created_at: 2026-07-08T00:00:00+08:00
updated_at: 2026-07-08T00:00:00+08:00
---

# TASK-0036 Program

## Objective
Implement day-windowed Team Workspace timeline pagination for file-backed report
events, keep Convex realtime hooks on Convex, and move report browsing toward
the same paged source.

## Files
- `tickets/TASK-0036/ticket.md`
- `tickets/TASK-0036/program.md`
- `tickets/TASK-0036/progress.md`
- `ui/vite.config.ts`
- `ui/src/modules/team-workspace/components/timeline-tab.tsx`
- `ui/src/modules/team-workspace/components/timeline-components.tsx`
- `ui/src/modules/team-workspace/components/team-timeline.ts`
- `ui/src/modules/team-workspace/lib/timeline/*`
- `ui/src/modules/team-workspace/components/tabs/reports/*`
- `docs/features/FEAT-0114-dashboard-projection-architecture.md`

## Metric
Mechanical + visual QA:
- Focused tests for timeline paging/report filtering pass.
- Root typecheck passes.
- Browser QA evidence is captured or explicitly blocked.

## Drift Policy
Before completion, compare implementation against `ticket.md` Done and QA
Strategy. Do not claim the full telemetry redesign; this implementation may
land a first slice over file-backed report timeline pagination while preserving
Convex realtime hooks.

## Completion Checkpoint
Update `progress.md`, run focused checks, run code-smell/refactor review, update
ticket verification/status, and report any unrun visual QA as residual risk.
