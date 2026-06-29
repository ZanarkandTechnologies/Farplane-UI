---
template_id: ticket-template
template_version: "0.1.3"
feature_refs:
  - FEAT-0007
  - FEAT-0008
ticket_id: TASK-XXXX
title: short title
phase: planning
status: review
owner: unassigned
# Active session alias such as codex-019ef784; empty when unclaimed.
claimed_by:
priority: medium
depends_on: []
blocked_by: []
ready: false
approval_required: true
requires_qa: true
requires_demo: false
created_at: 2026-04-03T00:00:00Z
updated_at: 2026-04-03T00:00:00Z
next_action: define the one current step and keep it in this field
last_verification: none
# Optional: decision_refs: []
---

# TASK-XXXX: title

<!-- Optional frontmatter field when needed: compute_target: local_shared | local_worktree | symphony | codex_cloud -->

## Summary
2-3 sentences on what changes, why it matters now, and the decisive path being
recommended.

## Scope
- In:
- Out:

## Delta
Keep this brief. Use it to orient the ticket before `impl-plan` expands the
work into concrete change units.

```text
overall_before:
  -
overall_after:
  -
why_now:
  -
problems:
  - before:
    after:
    why_now:
first_principles_basis:
  objective:
  need:
  assumptions:
  root_cause:
  constraints:
  first_viable_slice:
  proof_or_falsification:
  tradeoff:
  non_goals:
```

## Change Plan
Filled by `impl-plan(ticket)`. This is the executable task-local program and
file map. Group by coherent change unit so each unit carries its own problem
delta, reads, writes, operation, type or signature impact, QA, and route.

Repeat one heading and fenced block per coherent change:

### Change 1: short label

```text
fixes:
  - plain-language problem or delta this change resolves
before:
  -
after:
  -
read:
  - path:
    reason:
write:
  - path:
    change:
operation:
  -
signature_or_type_impact:
  -
routes:
  docs: doc-advisor | no_docs
  qa: tests | qa-tester | visual-qa | agent-qa-test | none
  review: reviewer | inline | none
qa:
  -
failure_modes:
  -
```

Optional visual system map only when topology, ownership boundaries, or typed
flow are easier to understand as a diagram:

```mermaid
flowchart LR
  %% Optional. Omit for localized tickets.
```

## Gap Analysis
- Required for missing, partial, parity-driven, or product-shaping feature work.
  Optional for tightly scoped bug fixes, internal refactors, or obvious
  one-surface changes.
- `Current state:` what exists today and where it stops
- `Production expectation:` what a credible production app usually includes for
  this feature
- `Missing gaps:` behaviors, UX states, edge cases, permissions, data flows,
  observability, or operational surfaces still absent
- `Comparable implementations:` products, repos, docs, or standards inspected
- `Recommendation:` what this ticket should land now vs defer into follow-ups

## Done
Keep this as the completion scoreboard: what must be true before the ticket can
close. Put checks, review gates, and evidence policy in `QA Strategy`.

```text
done_when:
  -
```

## QA Strategy
Filled by `impl-plan(ticket)`. This is the proof and QA plan that
`goal-advisor(ticket)` can lift into `program.md`, `progress.md`, and the
native `/goal` prompt.
Move bulky command output, screenshots, review reports, and logs to
`artifacts/`, then link them from `Links` or `progress.md`.
Durable proof defaults to `tickets/TASK-XXXX/artifacts/`; global
`.farplane/results/` is runtime scratch or explicit adapter output.
For material features, include critical-path QA here as flexible bullets:
name the real workflow or lifecycle being claimed, break long end-to-end proof
into ordered sanity checks, state the expected observation for each check, link
the evidence, and name any unrun final path or residual risk.
For material Goal-backed work, include the final checkpoint in this same block:
which QA evidence review, completion review, or reviewer TAS gate must run
before completion, and where its receipt will be linked.

```text
qa_strategy:
  proof_weight: smoke | tests | qa | visual_qa | review | agent_qa | demo
  checks:
    -
  manual:
    -
  delegated_lanes:
    -
  review:
    - rubric: none
      required_tas: none
  evidence:
    -
  goal_advisor_inputs:
    proof_route:
    final_evidence:
    final_checkpoint:
  residual_risk:
    -
```

## Docs Strategy
Use `doc-advisor` to decide whether durable docs change. Use `update_docs` for
README, feature/system specs, runbooks, templates, public guidance, or other
durable documentation edits. Use `no_docs` only with a concrete reason.

```text
docs_strategy:
  outcome: update_docs | no_docs
  doc_targets:
    -
  no_docs_reason:
  validation:
    -
```

## Agent Contract
- Optional for non-UI work. Add when the ticket changes UI, canvas rendering,
  user-visible flows, browser interaction, or any flow that is hard for agents
  to reach or inspect reliably.
- `Open:` launch path or command, plus stable route/deeplink if available
- `Test hook:` cheapest deterministic proof surface, or `none needed`
- `Stabilize:` reset/seed path plus shortcuts/debug controls if determinism matters
- `Inspect:` selectors, overlays, DOM mirrors, HUDs, or logs the agent should rely on
- `Key screens/states:` important surfaces QA must reach and compare
- `Design baseline:` `tickets/TASK-XXXX/design.md` when layout, interaction,
  visual design, or taste are part of proof; otherwise `none needed`
- `QA cookbook:` matching `qa/cookbook/<workflow>.md` path when the repo keeps
  reusable QA workflows, otherwise `none yet`
- `Taste refs:` relevant visual doctrine and any local exception
- `Expected artifacts:` screenshots, snapshots, traces, reports, or clips
- `Delegate with:` ticket path/section, recommended assignee, expected artifact

## Run Hints
- Optional for trivial/manual tickets. Add when `goal-advisor`, heartbeat,
  remote kanban, Codex Cloud, Symphony, or another unattended runner may use
  this ticket.
- These hints are advisory context, not runtime authority. Explicit invocation
  still starts work.
- `Likely size:` `tiny` | `normal` | `large` | `epic`
- `Goal recommendation:` `none` | `recommend` | `required`
- `Budget hint:` time/token/model/compute/subagent/review/QA/feedback/spend, or
  `none`
- `Compute hint:` `local_shared` | `local_worktree` | `codex_cloud` |
  `symphony` | `none`
- `Planning hint:` `none` | `light` | `impl_plan` | `reslice`
- `QA source:` `QA Strategy` or linked sidecar when the QA plan is too large
- `Batchability:` `batchable` | `single-ticket` | `unknown`
- `Batch reason:` shared module/workflow/setup/proof surface, or no-batch
  reason
- `Human inputs/assets:`
- `Credentials / external access:`
- `Compute/runtime needs:`
- `Tooling gaps:`
- `QA risks:`
- `Human gates:`
- `Agent decision boundaries:`

## Links
- `program:` `tickets/TASK-XXXX/program.md` or `none`
- `progress:` `tickets/TASK-XXXX/progress.md` or `none`
- `artifacts:`
- `review:`
- `refs:`

## Notes
- Keep sparse: blast radius, risks, rollback, citations, blockers, or follow-up
  boundaries only.
