---
ticket_id: TASK-0013
kind: generated-goal-prompt
status: approved
created_at: 2026-06-25
updated_at: 2026-06-25
---

# TASK-0013 Generated Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/TASK-0013/ticket.md
- tickets/TASK-0013/program.md
- tickets/TASK-0013/progress.md
- tickets/TASK-0013/generated-goal-prompt.md
- ui/src/modules/office/AGENTS.md
- ui/src/modules/office/README.md
- ui/src/modules/office/lib/office-area-layout.ts
- ui/src/modules/office/lib/office-layout-quality.ts
- ui/src/modules/office/systems/occupancy-system.ts
- ui/src/modules/office/systems/placement-engine.ts
- ui/src/providers/office-data-mapper.ts
- ui/src/providers/office-data-provider.test.ts

Task: Complete TASK-0013 end to end. Build a deterministic office layout solver
that reserves walkable path cells before optional furniture placement, wires the
solver to `team_neighborhoods`, preserves manual layout behavior, keeps
generated wall/divider behavior absent, and satisfies the ticket's Done / Proof.
Treat the listed ticket and program files as source of truth instead of
restating them.

Logging: Before ending each turn, append a compact progress entry to
tickets/TASK-0013/progress.md when ticket state, implementation state,
verification, blockers, or evidence changes.

Metric: Hybrid proof. Pass the focused Vitest suite named in the ticket, pass
`npm run typecheck:root`, pass `git diff --check`, and capture browser-visible
office evidence when the local UI launches cleanly.

Proof route: self implementation checks are allowed for mechanical tests.
UI/user-visible completion must include the strongest screenshot/image evidence
available, or a clear blocker explaining why screenshot proof could not be
captured. Do not count visual self-certification alone as final proof.

After each turn: Compare progress against ticket.md, program.md, and this
prompt. Continue while useful within the current implementation window. Stop
complete only when Done / Proof is satisfied and progress.md is updated; stop
blocked only after recording attempted paths and the missing input or runtime
blocker.

Budget: current implementation window; no external spend; no subagents required
unless QA/review isolation becomes useful.

Approval: approved. The operator explicitly requested Goal Advisor to run this
ticket end to end on 2026-06-25.

Final evidence: include checks run and the best screenshot as
![best evidence](ABSOLUTE_SCREENSHOT_PATH), or block/revise with the exact
missing screenshot proof reason.
```
