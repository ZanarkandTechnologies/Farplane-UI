---
ticket: TKT-029
title: Skill OS revamp goal program
loop_shape: active_goal
metric_provider: mechanical_browser_evidence
created_at: 2026-06-14
---

# Program

## Loop Shape

`active_goal`: execute TKT-029 in one focused window until the Skill OS
graph-first mini app is implemented, verified, or genuinely blocked.

## Files

- `tickets/building/TKT-029-skill-os-revamp/ticket.md`
- `tickets/building/TKT-029-skill-os-revamp/program.md`
- `tickets/building/TKT-029-skill-os-revamp/progress.md`
- `ui/src/components/hud/office-menu.tsx`
- `ui/src/modules/office/components/skills-panel.tsx`
- `ui/src/modules/office/components/use-skills-panel-controller.ts`
- `ui/src/modules/office/components/skills-panel-files-tab.tsx`
- `ui/src/store/app-store.ts`
- `ui/vite.config.ts`
- `/Users/kenjipcx/.codex/skills/skill-maintenance/graph/index.html`
- `/Users/kenjipcx/.codex/skills/skill-maintenance/graph/skill-graph.json`
- `/Users/kenjipcx/.codex/skills/skill-maintenance/graph/skill-docs.json`

## Budget

- time: one focused implementation pass
- token/model: not specified
- compute: local Node/Vite/Vitest/Playwright only
- subagents: none required
- review: inline drift check against ticket acceptance criteria
- QA: browser screenshots required
- spend: none

## Metric

Pass when all TKT-029 acceptance criteria have proof:

- focused lint/format on touched files passes
- focused tests pass or the ticket records why no unit target exists
- filtered typecheck shows no touched-file errors
- Playwright screenshots prove:
  - default graph-first Skill OS
  - sidebar selection focuses a graph node and opens overlay detail
  - graph node click opens overlay detail
  - no `Evals`, `Harness`, or legacy detail tab strip inside Skill OS
- endpoint snapshot proves `skill-graph.json` and `skill-docs.json` load real data
- final browser console has no meaningful errors

## Drift Policy

Inline drift check after implementation and before completion:

- compare the UI against `ticket.md`
- reject tabbed Skill OS regressions
- reject graph preview shapes that do not resemble the Skill Maintenance viewer
- reject proof that only tests endpoints without browser screenshots

## Logging

Append compact entries to `progress.md` for:

- Goal launch
- implementation changes
- verification commands
- browser proof
- blockers or follow-ups

## Stop Policy

- complete: all acceptance criteria pass with proof
- blocked: same blocker repeats after three meaningful attempts and cannot be
  bypassed without user input
- continue: if screenshots or checks reveal mismatch, patch and rerun proof
