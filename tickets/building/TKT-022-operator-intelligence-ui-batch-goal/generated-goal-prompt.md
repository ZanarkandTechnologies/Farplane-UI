# Generated Native Goal Prompt

```text
/goal Run the following files as one Goal Packet.

Files:
- tickets/building/TKT-022-operator-intelligence-ui-batch-goal/ticket.md
- tickets/building/TKT-022-operator-intelligence-ui-batch-goal/program.md
- tickets/building/TKT-022-operator-intelligence-ui-batch-goal/progress.md
- docs/specs/FP01-operator-intelligence-modules-roadmap.md
- tickets/todo/TKT-013-telemetry-bento-dashboard.md
- tickets/todo/TKT-014-skill-standards-registry-rollouts.md
- tickets/todo/TKT-015-eval-lab-qa-checklists.md
- tickets/todo/TKT-016-learning-inbox-memory-renderer.md
- tickets/todo/TKT-017-automations-dashboard.md
- tickets/todo/TKT-018-mighty-guard-harness-map.md
- tickets/todo/TKT-019-hardcase-data-inventory.md
- tickets/todo/TKT-020-goals-portfolio-org-sync.md
- tickets/todo/TKT-021-docs-bookshelf-testament-renderer.md
- tickets/INDEX.md
- ui/src/modules/README.md
- ui/src/modules/AGENTS.md

Task: Complete a quick first implementation pass across TKT-013 through
TKT-021. Preserve each source ticket's scope and Done / Proof, but optimize for
fast lift-and-shift: reuse existing Farplane modules, skill-maintenance graph
UI, eval/QA UI, Aikage UI ideas, and current shadcn-style Team Panel patterns
wherever possible. Do not overdesign. Do not create a project-tree-first UI,
theme panel refresh, separate office furniture ownership model, public hardcase
marketplace/export flow, or Mighty Guard auto-repair behavior.

Logging: Before ending each turn, update
tickets/building/TKT-022-operator-intelligence-ui-batch-goal/progress.md. Keep
the Source Ticket Proof Rows table current for TKT-013 through TKT-021, and add
a compact log entry with trigger, intent, actions, files/artifacts, metric or
feedback sample, drift verdict, next_action, and blockers. If a source ticket
moves lifecycle state or receives substantial proof, update that ticket too.

Metric: Satisfy the hybrid metric in program.md: one proof or blocker row per
source ticket, focused tests/lint/typecheck for touched code when practical,
browser screenshots for visible global launcher / Team Panel surfaces when
feasible, and review judgment that the batch follows FP01's Team Panel-first,
reuse-existing-UI direction.

After each turn: Compare progress against FP01, ticket.md Done / Proof, and
each touched source ticket. Continue from the largest proceedable gap inside
the quick-pass budget. Shell or defer fuzzy modules instead of stalling the
batch. Request reviewer lane before completion if shared shell architecture,
module registry contracts, or hardcase export policy expands. Stop complete
only when every source ticket has a proof/no-op/blocker row and batch checks or
documented check limitations are recorded. Stop blocked only after attempted
alternatives are logged and the missing input is concrete.

Budget: quick-pass batch. Spend none. Subagents allowed for independent source
discovery, browser QA, or review when useful.
```
