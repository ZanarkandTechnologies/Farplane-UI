---
ticket_id: TASK-0007
title: "Generated Native Goal Prompt"
status: approval_pending
owner: goal-advisor
created_at: 2026-06-24
updated_at: 2026-06-24
---

# Generated Native Goal Prompt

```text
/goal Run the following files as one Goal Packet.

Files:
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0007/ticket.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0007/program.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0007/progress.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0006/ticket.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0006/designs/00-hierarchy-design.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0006/designs/01-harness-design.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0006/designs/02-skills-design.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0006/designs/03-evals-design.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0006/designs/04-launcher-design.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0006/designs/05-roadmap.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/AGENTS.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/PROJECT_RULES.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/docs/farplane-framework/harness-maintenance.md
- /Users/kenjipcx/Zanarkand Technologies/projects/Farplane/experiments/decisions/2026-06-24-project-harness-rollout-feature/farplane-ui-handoff.md

Task: Implement the desired outcomes defined across the listed ticket, program, and design files. Treat TASK-0007 as the implementation contract and TASK-0006 as the UI design source of truth. Keep Skills, Evals, and Harness as first-class operator panels. Restructure Harness into Health, Map, and Rollout. Preserve existing Skill OS, Eval OS, and Harness graph/lifecycle behavior while adding the new hierarchy, rollout shells/data paths, loading/empty/error states, launcher/dial behavior, and cross-links described in the designs.

Logging: Before ending each turn, append a compact structured entry to /Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/tickets/TASK-0007/progress.md with changed files, completed slice, verification run, screenshots captured, blockers, and next action. Do not use progress.md as transcript storage.

Metric: Satisfy the Done / Proof and metric provider declared in TASK-0007. Mechanical proof includes npm run ui:build, git diff --check on touched UI/ticket files, and focused tests for new pure helpers. Visual proof includes desktop/mobile Playwright screenshots and console/page error capture for Harness Health, Harness Map, Harness Rollout, Skills, and Evals. Do not count self-certification as final visual acceptance; final design acceptance requires visual-qa or human review.

After each turn: Compare progress against the listed files and the TASK-0006 hierarchy. Continue within the current execution window while useful. Stop complete only when the ticket proof is satisfied and progress.md contains the proof summary. Stop blocked if CLI data sources cannot be reached, existing unrelated repo debt blocks honest verification, UI screenshot proof cannot be captured, or design contradictions require operator choice.

Budget: one native Goal execution window; no deploys, no spend, no registry/manifest/template/skill/eval mutation unless explicitly in ticket scope. Stop and report if the full scope needs to split into a follow-up ticket.

Proof route: implementer captures Playwright screenshots/logs/result notes -> visual-qa or human review judges screenshots against TASK-0006 designs -> final readiness is accepted only after visual evidence is reviewable. Self-certification is allowed for mechanical command outputs only.

Final evidence: final response includes Markdown image links for the strongest proof screenshots, for example ![best evidence](/ABSOLUTE_SCREENSHOT_PATH), plus command summaries and any blockers. If screenshot proof is missing, block/revise with the exact missing proof.

Approval: This prompt may be run only after the human has approved the current Goal Packet. If the ticket plan changes after this packet was compiled, return to goal-advisor, regenerate the packet, and ask for approval again.
```
