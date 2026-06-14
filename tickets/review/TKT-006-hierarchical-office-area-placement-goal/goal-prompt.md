# TKT-006 Native Goal Prompt

```text
/goal Run tickets/review/TKT-006-hierarchical-office-area-placement-goal/ticket.md as a Goal Packet.
Task: Implement hierarchy-aware office area placement for Farplane UI. Derive stable area hierarchy from departments, projects, and Codex project paths; allocate deterministic treemap-style regions over the live office layout bounds; render visible floor/boundary/label cues for top-level and nested areas; and use project area centers as preferred team-cluster anchors while preserving existing placement/collision safeguards and manual persisted cluster positions.
Logging: Before ending each turn, append a compact structured entry to tickets/review/TKT-006-hierarchical-office-area-placement-goal/progress.md with trigger, intent, actions, files/artifacts, metric or visual sample, drift verdict, next_action, and blockers.
Metric: Satisfy the hybrid metric in tickets/review/TKT-006-hierarchical-office-area-placement-goal/program.md: focused pure tests for hierarchy derivation and deterministic area allocation, mapper/placement tests for team preferred anchors and fallbacks, targeted lint/type evidence for changed files, and Playwright screenshot proof that `/office` visibly groups Farplane UI / related teams under a Zanarkand/Farplane area without unreadable clutter or collisions.
After each turn: compare progress against ticket.md and program.md, keep the implementation scoped to the largest unresolved acceptance/evidence gap, preserve existing office placement engine boundaries, request reviewer help only if the work expands into schema migration or broad office-builder redesign, then continue, stop complete, or report blocked with attempted paths and one missing input.
```
