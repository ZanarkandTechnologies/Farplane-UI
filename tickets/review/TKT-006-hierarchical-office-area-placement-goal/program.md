# TKT-006 Goal Program

## Loop Shape

- trigger_mode: `active_goal`
- loop_owner: native Codex Goal mode
- next_owner: implementation lane in the Goal thread
- stop_condition: all acceptance criteria are implemented or explicitly split, mechanical tests pass or blockers are recorded, browser screenshots prove visible office areas, and ticket/progress files reflect final state

## Metric / Feedback Provider

- provider: `hybrid`
- mechanical evidence:
  - pure tests prove hierarchy derivation and deterministic area allocation
  - mapper tests prove project area centers become preferred team-cluster anchors
  - placement tests prove collision/layout fallbacks still protect the office
  - targeted lint/type evidence covers changed files
- visual evidence:
  - Playwright screenshot of `/office` proves visible colored/bounded areas and readable labels
  - screenshot or debug snapshot proves Farplane UI / related teams are grouped under the same parent area
- review evidence:
  - inline self-review against office module invariants
  - external reviewer only if the implementation expands into a persistent area editor, new sidecar schema migration, or broad scene-rendering redesign

## Drift Policy

- drift_check: inline each turn
- compare:
  - `ticket.md` acceptance criteria
  - this `program.md` loop shape and stop condition
  - recent `progress.md` entries
- use external drift reviewer only if:
  - the goal starts editing root office-builder concepts instead of adding an area-placement layer
  - the algorithm starts replacing the existing placement/occupancy engine
  - the implementation needs a sidecar schema migration

## After Each Turn

1. Append a compact entry to `progress.md` with trigger, intent, actions, files/artifacts, metric or visual sample, drift verdict, blockers, and next action.
2. Keep the first implementation pure and testable: hierarchy builder, treemap allocator, project-area anchor resolver.
3. Integrate through `office-data-mapper` and scene components only after pure tests exist.
4. Preserve persisted manual cluster positions unless they are invalid or the code path is explicitly auto-arranging generated clusters.
5. Capture browser screenshots before claiming the visual area concept works.
6. Stop complete only when the product signal is visible in the office, or report blocked with attempted paths and the one missing input.

## Native Goal Prompt

See `goal-prompt.md`.
