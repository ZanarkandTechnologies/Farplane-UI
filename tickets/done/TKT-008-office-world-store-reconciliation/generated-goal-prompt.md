---
id: TKT-008-generated-goal-prompt
ticket: TKT-008
status: active
created: 2026-06-13
updated: 2026-06-13
---

# Native Goal Prompt

```text
/goal Run tickets/building/TKT-008-office-world-store-reconciliation/ticket.md as a Goal Packet.

Task: Complete TKT-008 by implementing the office world store and reconciliation boundary. Add a module-local Zustand office world store, pure reconciliation helper, narrow selectors, provider commit path, first scene/bootstrap selector migration, focused tests, office README update, and browser proof. Preserve existing useOfficeDataContext() compatibility during migration. Keep useAppStore responsible for transient UI intent only. Do not implement a full ECS/game loop, do not change Codex/OpenClaw source-of-truth behavior, and do not overwrite unrelated dirty worktree changes.

Logging: Before ending each turn, append a compact structured entry to tickets/building/TKT-008-office-world-store-reconciliation/progress.md with trigger, intent, actions, files/artifacts, metric or feedback sample, drift verdict, next_action, and blockers.

Metric: Satisfy tickets/building/TKT-008-office-world-store-reconciliation/program.md using hybrid proof: focused Vitest tests for reconciliation/store/provider behavior, git diff --check, attempted ui typecheck with honest debt reporting, and browser QA showing /office remains loaded across at least two poll intervals with stable poll logs.

After each turn: Compare progress against ticket.md and program.md, run inline drift review, continue from the largest unresolved Done / Proof gap, stop complete only after code/docs/tests/browser proof/ticket state are done, or report blocked with attempted paths and one missing input.
```
