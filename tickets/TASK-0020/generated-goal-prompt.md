---
ticket_id: TASK-0020
title: Generated Goal Prompt - Chat History Mining Programs Platform
created_at: 2026-06-28
updated_at: 2026-06-28
approval: approved
---

# Generated Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/TASK-0020/ticket.md
- tickets/TASK-0020/design.md
- tickets/TASK-0020/program.md
- tickets/TASK-0020/progress.md

Task: Implement the Chat History Mining Programs Platform defined across the
listed files. Build the Thread Data workbench with program CRUD, source
filtering, backfill job creation, file-backed job outputs, run progress, output
review, and the first bounded bundled program path. Preserve ticket scope,
privacy constraints, UI workflow, Done / Proof, budget, blocker policy, and stop
conditions. Treat the listed files as source of truth; do not rely on transcript
memory.

Logging: Before ending each turn, append a compact structured entry to
`tickets/TASK-0020/progress.md` with changed files, verification, evidence,
blockers, and next action.

Metric: Satisfy the Done / Proof in `ticket.md` and the hybrid metric in
`program.md`: mechanical checks, UI evidence, QA evidence subagent, and
completion review subagent. Do not count self-certification as final proof.

Proof route: After implementation, run a QA evidence subagent to operate the UI
and capture screenshots/logs/result notes. Then run a completion review subagent
to compare ticket/program/design/progress, changed files, and QA evidence
against Done / Proof. Completion requires both lanes or a recorded blocker.

Grounding: Before final completion, name the source class checked for coding/UI
implementation evidence: local module patterns, official docs, maintained
examples, GitHub code search, or web sources. If grounding is local-only, state
why.

After each turn: Compare progress against the listed files. Continue within the
current time/budget window if useful. Stop complete only when Done / Proof is
satisfied, `progress.md` is updated, delegated QA evidence and completion review
are recorded, and final response can include strongest screenshot evidence as
Markdown image syntax. Stop blocked only with attempted paths and one concrete
missing input.

Budget: local development only; no deploy/spend. Preserve unrelated dirty
worktree changes.

Approval: approved by operator request on 2026-06-28.
```

