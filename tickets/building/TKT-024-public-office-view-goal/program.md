---
ticket: TKT-024
title: Public read-only office view goal program
status: active
created_at: 2026-06-14
loop_shape: active_goal
metric_provider: hybrid
---

# Goal Program

## Objective

Implement a livestream-safe public office view that renders Farplane's live
office without permitting writes or exposing obvious stream-sensitive details.

## Files

- `tickets/building/TKT-024-public-office-view-goal/ticket.md`
- `tickets/building/TKT-024-public-office-view-goal/program.md`
- `tickets/building/TKT-024-public-office-view-goal/progress.md`
- `tickets/building/TKT-024-public-office-view-goal/generated-goal-prompt.md`
- `AGENTS.md`
- `PROJECT_RULES.md`
- `ARCHITECTURE.md`
- `qa/README.md`
- `ui/src/AppRouter.tsx`
- `ui/src/pages/OfficePage.tsx`
- `ui/src/shell/shell-config.ts`
- `ui/src/shell/FarplaneShell.tsx`
- `ui/src/modules/runtime/lib/adapters/contract.ts`
- `ui/src/modules/runtime/runtime-adapter-provider.tsx`
- `ui/src/modules/runtime/lib/adapters/factory.ts`
- `ui/src/providers/office-data-provider.tsx`
- `ui/src/providers/office-data-mapper.ts`
- `ui/src/components/office-simulation.tsx`
- `ui/src/components/hud/office-menu.tsx`
- `ui/src/components/hud/office-panel-registry.ts`
- `ui/src/components/hud/builder-toolbar.tsx`
- `ui/src/components/hud/furniture-shop.tsx`
- `ui/src/components/hud/user-tasks-panel.tsx`
- `ui/src/components/hud/ceo-task-detail-modal.tsx`
- `ui/src/components/hud/create-team-form.tsx`
- `ui/src/modules/chat/hooks/use-chat-messages.ts`
- `ui/src/modules/chat/hooks/use-chat-threads.ts`
- `ui/src/modules/office/components/agent-session-panel.tsx`
- `ui/src/modules/office/components/object-config-panel.tsx`
- `ui/src/modules/office/components/object-transform-panel.tsx`
- `ui/src/modules/office/hooks/use-delete-office-object.ts`
- `ui/src/modules/office/systems/placement-system.ts`
- `ui/src/modules/office/scene/office-layout-editor.tsx`
- `ui/src/modules/settings/settings-dialog.tsx`
- `ui/src/modules/settings/use-codex-office-visibility-settings.ts`
- `ui/src/modules/team-workspace/components/task-detail-modal.tsx`

## Loop Shape

- type: `active_goal`
- owner: native Codex Goal
- execution style: implement, verify, browser QA, reconcile ticket
- pause policy: pause only for destructive operations, auth/deployment scope,
  unresolved privacy product decisions beyond basic redaction, or repeated
  browser/runtime blocker

## Budget

- time: one focused implementation window
- token/model/compute: not specified
- subagents: allowed for browser QA or focused review
- review: required before completion if implementation changes runtime adapter
  contracts broadly
- QA: browser screenshots required
- spend: none
- deployment: none

## Metric / Feedback Provider

Hybrid:

- mechanical: focused Vitest tests for access mode, adapter wrapper, provider
  read-only skip, and action gating
- type safety: touched-file typecheck or full UI typecheck when feasible
- visual: browser screenshots for public route and gated surfaces
- behavioral: blocked write attempts return stable `readonly_mode` and do not
  invoke underlying mutation methods
- review: ticket AC/Evidence reconciliation before completion
- human feedback: operator judgment after seeing public-view proof

## Drift Policy

- Inline drift check after each material phase.
- Compare edits against these boundaries:
  - public route is read-only and stream-safe, not auth/deployment
  - `/office` operator behavior remains unchanged
  - UI gating is backed by adapter/provider write blocking
  - provider auto-repair does not persist in read-only/public mode
  - redaction is basic and obvious, not an unlimited privacy sweep
- Stop and create a follow-up ticket instead of absorbing:
  - authentication/invite links
  - remote hosting or public internet deployment
  - complete privacy/compliance audit
  - unrelated UI redesign

## Logging Policy

Append compact entries to `progress.md` after:

- context/read pass
- access-mode architecture
- read-only adapter/provider implementation
- UI gating/redaction implementation
- tests/checks
- browser QA
- final ticket reconciliation

Each entry should include changed files, verification, artifacts, drift verdict,
next action, and blockers.

## Proof Policy

Do not call the goal complete without:

- route-level browser screenshot for `/office/public`
- screenshots or snapshots for disabled/hidden mutating controls
- a blocked mutation proof that returns `readonly_mode`
- proof provider auto-repair persistence is skipped in public/read-only mode
- tests recorded in `progress.md`
- QA report linked from `ticket.md`

## Stop Conditions

- complete: all ACs pass, screenshots and blocked-mutation proof exist, checks
  are recorded, and `ticket.md` is reconciled
- blocked: after three consecutive attempts the same blocker prevents
  implementation or browser proof and one missing input/external condition is
  named
- continue: useful implementation, test, QA, or reconciliation work remains
  inside the current budget window

## Current Next Action

Start native Goal execution. First implement typed access mode and public route,
then add adapter/provider write blocking before UI gating, then verify with
focused tests and browser QA.
