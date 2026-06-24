---
ticket_id: TASK-0009
title: Stabilize Office Refresh And Project District Layout
phase: proof
status: review
owner: Farplane UI
claimed_by: Codex
priority: high
depends_on: []
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-06-24
updated_at: 2026-06-24
next_action: browser/visual QA if needed; otherwise review and close
last_verification: focused Vitest suite passed 55 tests and npm run typecheck:root passed after round 3 fixes
---

# TASK-0009: Stabilize Office Refresh And Project District Layout

## Summary
Fix the office reload/layout churn and Project District placement bugs found
while iterating on room generation. The ticket uses a bounded runtime-debugging
council loop: patch the highest-confidence bugs, verify, then run another
council until either no actionable bugs remain or 3 rounds have completed.

## Scope
- In:
  - Prevent volatile Codex config timestamps from invalidating structural poll
    signatures.
  - Keep live-status changes from looking like structural employee/layout
    changes.
  - Avoid full scene teardown when loading re-enters after an office has already
    rendered.
  - Reduce generated wall collisions with preserved furniture and table/lane
    occupancy regressions when feasible in this pass.
  - Add focused tests for each fixed bug.
  - Run up to 3 read-only runtime-debugging council rounds and synthesize
    remaining findings into fixes or follow-up notes.
- Out:
  - Replacing the office renderer.
  - Rewriting Project Districts from scratch.
  - Shipping a full browser automation suite unless needed to prove a fix.
  - Fixing unrelated dirty worktree changes.

## Done / Proof

```text
done_when:
  - unchanged structural polls skip expensive remap/repair even under Codex
  - status-only updates do not churn layout-facing employees, office objects,
    office areas, or office settings
  - re-entering loading after first successful office data does not unmount the
    existing scene
  - fixed wall/layout bugs have focused regression coverage
  - at most 3 runtime-debugging council rounds have run, and the final round
    produces no new high-confidence in-scope fixes or remaining issues are
    recorded as follow-ups

proof:
  checks:
    - focused Vitest for provider, mapper/stability, layout/walls, and scene/store
    - npm run typecheck:root
  manual:
    - browser/visual proof if code changes affect rendered scene behavior and
      local server is available in the turn
  review:
    - rubric: fixes match evidence, no unrelated worktree reverts, no hidden
      self-approval for visual-only behavior
      required_tas: self-review plus optional delegated council/reviewer
  evidence:
    - tickets/TASK-0009/progress.md
    - command output summarized in final response
```

## State
- `next_action:` browser/visual QA if needed; otherwise review and close.
- `blocked:` false
- `latest_verification:` focused Vitest suite passed 55 tests; root typecheck
  passed.
- `result:` three runtime-debugging council rounds completed; high-confidence
  in-scope findings fixed; visual QA remains optional/manual.

## Links
- `program:` tickets/TASK-0009/program.md
- `progress:` tickets/TASK-0009/progress.md
- `artifacts:` none yet
- `review:` runtime-debugging councils
- `refs:` `ui/src/providers/office-data-provider.tsx`, `ui/src/providers/office-data-stability.ts`, `ui/src/components/office-simulation.tsx`, `ui/src/providers/office-data-mapper.ts`
