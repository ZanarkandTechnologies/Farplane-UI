---
ticket_id: TASK-0033
kind: native-goal-prompt
status: approved
created_at: 2026-06-29
updated_at: 2026-06-29
---

# Native Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/TASK-0033/ticket.md
- tickets/TASK-0033/program.md
- tickets/TASK-0033/progress.md
- tickets/TASK-0033/goal.md
- AGENTS.md
- PROJECT_RULES.md
- ui/src/modules/team-workspace/AGENTS.md
- ui/src/modules/team-workspace/README.md
- ui/src/modules/team-workspace/index.ts
- ui/src/modules/team-workspace/components/team-panel.tsx
- ui/src/modules/team-workspace/components/farplane-project-config.tsx
- ui/src/modules/team-workspace/components/overview-tab.tsx
- ui/src/modules/team-workspace/components/overview-tab.helpers.ts
- ui/src/modules/team-workspace/components/overview-tab.helpers.test.ts
- ui/src/modules/team-workspace/components/operator-intelligence-tabs.tsx
- ui/src/modules/team-workspace/components/task-detail-modal.tsx
- ui/src/modules/team-workspace/components/kanban-tab.tsx
- ui/src/modules/team-workspace/components/timeline-tab.tsx
- ui/src/modules/team-workspace/components/team-panel-types.ts

Task: Complete TASK-0033 exactly as defined by ticket.md and program.md. Refactor
the Team Workspace tab layer into focused internal folders while preserving
public TeamPanel behavior, tab ids, data loading, store keys, Timeline Configure
Hooks behavior, and existing dirty worktree changes not owned by this ticket.
Do not refactor unrelated modules such as thread-data-panel.tsx.

Logging: Before ending each turn, append a compact structured entry to
tickets/TASK-0033/progress.md when ticket state changes. Update ticket.md with
phase/status, last_verification, links, evidence, and residual risk before
completion.

Metric: Satisfy ticket Done conditions and program Metric. Mechanical proof is
focused Team Workspace checks, Biome, root typecheck, and filtered UI typecheck.
Structural proof is smaller focused tab folders without generic utilities or
public API churn. Visual proof is browser smoke evidence of Team Panel tabs.

QA proof route: executor runs focused tests and browser smoke; use delegated
reviewer or visual-qa if the final diff becomes broad, risky, or visually
ambiguous. Self-certification is allowed only for mechanical command results,
not for skipped visual evidence.

Final checkpoint: Before stop_complete, compare the diff against ticket.md and
program.md, record strongest command evidence, browser screenshot path, review
decision, and residual risk in ticket.md plus progress.md. If visual evidence is
missing, stale, or blocked, stop blocked or revise instead of claiming done.

After each turn: Check drift against the listed files. Continue within the
current local pass if useful; otherwise stop complete or stop blocked with one
missing input. Final response must include Ticket, Verification, Artifacts,
Grounding, and Residual risk lines.

Grounding: This is local-only refactoring unless a library/API uncertainty
arises. If any library/API behavior is changed, check official docs or maintained
examples and name the source class.

Final evidence: include ![best evidence](ABSOLUTE_SCREENSHOT_PATH), or
block/revise with the exact missing screenshot proof.

Approval: approved by operator request to create the Goal and implement the
refactor. If the ticket plan changes materially, return to goal-advisor,
regenerate the packet, and continue from the updated files.
```
