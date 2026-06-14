# TKT-022 Goal Program

## Trigger

- batch_goal: run a quick implementation pass across TKT-013 through TKT-021
  inside one Goal window.

## Execution Profile

- Bias: lift-and-shift existing UI first, then adapt to Farplane style.
- Time policy: quick pass; prefer visible shells, reused components, and small
  normalizers over deep rewrites.
- Ticket policy: advance proceedable tickets, skip or shell fuzzy tickets, and
  log one proof/blocker row per source ticket.
- Subagents: allowed for independent source discovery, browser QA, or review
  if they materially improve throughput.
- Spend: none.

## Metric / Feedback Provider

- hybrid:
  - mechanical: focused tests/lint/typecheck for touched code when practical
  - browser evidence: screenshots for global launcher and Team Panel surfaces
    changed by the batch when feasible
  - artifact proof: one source-ticket proof row in `progress.md`
  - review judgment: quick-pass fidelity to FP01, current Team Panel model, and
    "reuse existing UI; do not overdesign"

## Drift Policy

- Inline drift check after each material step:
  - compare implementation against FP01 and the relevant source ticket
  - preserve the Team Panel-first model
  - avoid project-tree/furniture/theme-refresh drift
  - keep hardcases as eval/QA filter first and Mighty Guard advisory first
- Use reviewer lane before completion if the batch changes shared shell
  contracts, module registry architecture, or hardcase export policy.

## Stop Conditions

- complete: every source ticket has either a visible first-pass implementation
  with proof, an explicit no-op proof, or a documented blocker/deferral, and
  batch-level checks/evidence are recorded.
- blocked: three consecutive attempts cannot find/source/build the needed UI
  surface and no safe shell can be produced.
- pause: operator redirects scope, requests a narrower slice, or a destructive
  migration/deploy/auth decision would be required.

## Current Execution Order

1. Read FP01 and source tickets TKT-013 through TKT-021.
2. Inventory existing Farplane modules and local Aikage/skill UI sources.
3. Pick the fastest proceedable order, prioritizing reuse:
   - telemetry polish/no-op proof
   - skills graph lift
   - eval/QA lift
   - docs/memory Markdown rendering
   - goals shell
   - hardcase filter
   - automations source state
   - Mighty Guard advisory shell
   - docs/testament library
4. Implement one small vertical slice at a time.
5. After each source ticket changes, append a proof row to `progress.md`.
6. Run focused checks and browser QA when surfaces are visible.
7. Summarize completed/blocked tickets and next batch if needed.
