---
ticket_id: TASK-0014
kind: program
status: verified
created_at: 2026-06-25
updated_at: 2026-06-25
---

# TASK-0014 Program

```text
objective:
  Make the operator's three-phase algorithm the canonical automatic office
  layout solver.

algorithm:
  1. render_strategy_graph(strategy, teams, existing_objects)
     -> compact_seed + required_objects + strategy_debug
  2. reserve_shortest_walk_paths(compact_seed, required_objects)
     -> reserved_walk_tiles + route_debug
  3. pack_optional_objects(compact_seed, reserved_walk_tiles, optional_objects)
     -> placed_optional_objects + packing_debug
  4. prune_empty_edges(placed_required, placed_optional, reserved_walk_tiles)
     -> final_layout + quality_debug

invariants:
  - manual layout bypasses the solver and preserves coordinates exactly
  - all automatic strategies use the same solver after strategy seed creation
  - reserved walk tiles are walkable but unavailable for optional object
    placement
  - pruning cannot remove required object footprint, required object access,
    reserved walk tiles, or connectivity between important POIs
  - no generated wall/divider behavior is restored

metric:
  hybrid:
    - mechanical tests for solver stage behavior and mapper strategy routing
    - root TypeScript check
    - diff whitespace check
    - browser screenshot evidence for user-visible layout

budget:
  time: current implementation window
  token_model_compute: not specified
  subagents: none required unless QA/review isolation becomes useful
  spend: none

drift_policy:
  Before final response or any continuation, compare work against ticket.md,
  this program, and progress.md. If implementation starts optimizing some other
  layout idea instead of the listed algorithm, stop and re-center on the
  algorithm.

proof_route:
  self-run mechanical checks are acceptable. Browser-visible completion must
  include screenshot evidence or a clear blocker. If a reviewer lane is
  available after implementation, use it as advisory; do not block mechanical
  progress waiting for it.

stop_policy:
  complete when Done / Proof in ticket.md is satisfied and progress.md records
  changed files, checks, screenshot path, sidecar restore status, and residual
  risk. Block only after recording attempted paths and the exact missing input.
```
