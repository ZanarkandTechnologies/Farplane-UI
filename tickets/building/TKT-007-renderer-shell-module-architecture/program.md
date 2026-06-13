# TKT-007 Goal Program

## Loop Shape

- type: `active_goal`
- owner: native Codex Goal
- ticket: `tickets/building/TKT-007-renderer-shell-module-architecture/ticket.md`
- progress: `tickets/building/TKT-007-renderer-shell-module-architecture/progress.md`
- goal prompt: `tickets/building/TKT-007-renderer-shell-module-architecture/goal-prompt.md`

## Objective

Make Farplane UI's renderer/module architecture explicit and executable:

- `renderer = standard | office3d`
- renderers compose and arrange modules
- modules own feature capabilities
- `ui/src/lib` owns shared helpers after real reuse
- first-party modules use static imports and an explicit registry; any module id type is derived from that registry
- no `console` module, no dynamic plugin loader, no `packages/` boundary in this slice

## Metric / Feedback Provider

- provider: `hybrid`
- mechanical:
  - `git diff --check`
  - focused import/type/test checks only if implementation moves code
- review:
  - ticket `Done / Proof` checkboxes are satisfied
  - architecture boundary is legible from the spec and repo rules
  - changed files do not expand scope beyond TKT-007
- human:
  - operator can read the spec and confirm the naming answers "Office or standard web?"

## Drift Policy

- inline drift check after each turn
- compare current edits against `ticket.md` scope and this `program.md`
- stop and create follow-up tickets instead of absorbing old Sigmax/Aikage/Farplane Console feature migration into this ticket
- do not self-expand into runtime storage design, product roadmap restructuring, or a `packages/` migration

## Turn Routine

1. Read `ticket.md`, this `program.md`, latest `progress.md`, and touched files before edits.
2. Execute the largest unresolved Done / Proof gap.
3. Keep changes additive and reversible unless the ticket explicitly asks for a move.
4. Run the narrowest honest verification.
5. Append a progress entry before ending the turn.
6. Mark complete only when Done / Proof is satisfied and verification is recorded.

## Stop Conditions

- complete:
  - `docs/specs/module-shell-architecture.md` exists and captures renderer/module/lib rules
  - repo/module rules include compact renderer guidance
  - `ui/src/shell/README.md` or equivalent first seam doc exists
  - `git diff --check` passes for touched files
  - `progress.md` records final proof
- blocked:
  - a destructive move, external dependency, or material product decision appears that is not already covered by the ticket
  - repeated verification cannot run because of unrelated repo state and no narrower proof is available

## Current Next Action

Create the architecture spec and compact repo-rule updates, then add the first shell seam documentation.
