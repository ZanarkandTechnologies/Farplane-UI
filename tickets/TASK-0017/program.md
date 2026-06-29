---
ticket_id: TASK-0017
kind: goal-program
status: active
created_at: 2026-06-28T13:40:38+0800
updated_at: 2026-06-28T13:40:38+0800
owner: goal-advisor
loop_shape: active_goal
approval: approved
---

# TASK-0017 Goal Program

## Goal Architecture

```text
active_goal(ticket.md, program.md, progress.md)
  -> game_style_team_panel_hud + source_read_model + browser_evidence + completion_entry
```

## Files

- `tickets/TASK-0017/ticket.md`
- `tickets/TASK-0017/program.md`
- `tickets/TASK-0017/progress.md`
- `tickets/TASK-0017/generated-goal-prompt.md`
- `qa/cookbook/team-panel-farplane-config.md`
- `farplane/manifest.json`
- `farplane/harness.md`
- `farplane/goals.md`
- `farplane/products.md`
- `farplane/automations.md`
- `farplane/bindings.md`
- `farplane/evals.md`
- `farplane/hooks.json`
- `farplane/pm.json`
- `ui/src/modules/team-workspace/components/team-panel.tsx`
- `ui/src/modules/team-workspace/components/overview-tab.tsx`
- `ui/src/modules/team-workspace/components/operator-intelligence-tabs.tsx`
- `ui/src/modules/team-workspace/components/team-panel-types.ts`
- `ui/src/modules/team-workspace/components/kanban-tab.tsx`
- `ui/src/modules/team-workspace/components/telemetry-tab.tsx`
- `ui/src/modules/telemetry/telemetry-dashboard-content.tsx`
- `ui/vite.config.ts`

## Trigger

Manual native Goal run requested by the operator on 2026-06-28.

## Budget

- `time:` current uninterrupted implementation window.
- `token/model:` not specified.
- `compute:` local dev server, browser QA, tests, build.
- `subagents:` optional only for QA/review lanes if available and useful.
- `spend/deploy/external mutation:` none allowed.

## Metric / Feedback Provider

Hybrid proof:

- `mechanical:` Farplane validator, focused Team Panel tests, UI build, diff
  check.
- `browser_qa:` screenshots and tab interaction proof for all required tabs.
- `visual_review:` verify Overview is CEO/KPI-first and game-style affordances
  improve scanability without hiding provenance.
- `human_feedback:` optional after first implementation screenshot.

No fake numeric design metric is allowed. Missing data providers must render as
`provider_missing`, `unavailable`, `stale`, or `proxy`.

## Drift Policy

Inline drift check after each major implementation phase:

1. Compare current edits against `ticket.md` `Done / Proof`.
2. Confirm Overview remains CEO/KPI-first, not config-first.
3. Confirm existing Kanban and Telemetry reuse are preserved.
4. Stop or revise if the read model broadens into recursive browsing, writes
   config, or fakes runtime/KPI/proof data.

Use delegated QA or reviewer lanes before completion when available. Self
certification is not sufficient for final visual/user-visible proof.

## Proof Route

```text
implementation -> focused tests/build/validator -> browser QA screenshots/logs
  -> visual/review judgment -> ticket progress writeback -> final evidence
```

Final completion requires a Markdown image link to the strongest screenshot or
a blocker explaining exactly why browser evidence could not be captured.

## Grounding Rule

This is local-first UI work. Before final completion, name the source class
checked:

- local Farplane files;
- local Team Panel / Telemetry source;
- game dashboard pattern grounding already captured in `ticket.md`.

If any external/library API uncertainty appears, check official docs or
maintained examples before changing that API path.

## Stop Policy

- `complete:` all `Done / Proof` requirements in `ticket.md` are satisfied and
  final image evidence exists.
- `blocked:` after attempted alternatives, a required source/API/server/browser
  path cannot be made available in this environment; log exact blocker and next
  missing input.
- `revise:` if browser/visual proof shows the HUD is cluttered, config-first,
  fake, or breaks Kanban/Telemetry.
