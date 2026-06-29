---
ticket_id: TASK-0017
kind: generated-goal-prompt
status: approved
created_at: 2026-06-28T13:40:38+0800
updated_at: 2026-06-28T13:40:38+0800
owner: goal-advisor
---

# Generated Native Goal Prompt

```text
/goal Run the following files as one Goal Packet.

Files:
- tickets/TASK-0017/ticket.md
- tickets/TASK-0017/program.md
- tickets/TASK-0017/progress.md
- tickets/TASK-0017/generated-goal-prompt.md
- qa/cookbook/team-panel-farplane-config.md
- farplane/manifest.json
- farplane/harness.md
- farplane/goals.md
- farplane/products.md
- farplane/automations.md
- farplane/bindings.md
- farplane/evals.md
- farplane/hooks.json
- farplane/pm.json
- ui/src/modules/team-workspace/components/team-panel.tsx
- ui/src/modules/team-workspace/components/overview-tab.tsx
- ui/src/modules/team-workspace/components/operator-intelligence-tabs.tsx
- ui/src/modules/team-workspace/components/team-panel-types.ts
- ui/src/modules/team-workspace/components/kanban-tab.tsx
- ui/src/modules/team-workspace/components/telemetry-tab.tsx
- ui/src/modules/telemetry/telemetry-dashboard-content.tsx
- ui/vite.config.ts

Task: Implement TASK-0017. Redo the Team Panel as a game-style Farplane project
HUD with top-level tabs Overview, Goals, Products, Kanban, Cadence, Telemetry,
and Config. Overview must be CEO/KPI-first, showing current goal, KPI gauges,
ticket status, AI burn, telemetry headline, proof health, harness traits/rules,
and PM leader card. Preserve existing Kanban behavior and reuse project/team
TelemetryDashboardContent for the Telemetry tab. Treat the listed ticket and
program files as the source of truth; do not restate or broaden their scope.

Logging: Before ending each turn, append a compact structured entry to
tickets/TASK-0017/progress.md with changed files, proof run, screenshots, drift
status, blockers, and next action.

Metric: Satisfy the Done / Proof in tickets/TASK-0017/ticket.md and the hybrid
metric in tickets/TASK-0017/program.md. Missing KPI/runtime/eval/report
providers must render as provider_missing, unavailable, stale, or proxy. Do not
count self-certification as QA, visual judgment, or final completion proof.

Proof route: implementation -> Farplane validator + focused Team Panel tests +
UI build + diff check -> browser QA screenshots/logs for all required tabs ->
visual/review judgment. Existing Kanban and Telemetry reuse must remain intact.

After each turn: Compare progress against ticket.md and program.md. Continue
within the current work window if useful. Stop complete only when all Done /
Proof requirements are satisfied and browser evidence exists. Stop blocked only
after trying reasonable alternatives and logging the exact missing source, API,
server, or browser capability.

Grounding: This is local-first UI work. Final response must name local Farplane
files and local Team Panel/Telemetry code as source classes checked. If external
or library API uncertainty appears, check official docs or maintained examples
before changing that API path.

Final evidence: include ![best evidence](ABSOLUTE_SCREENSHOT_PATH), or
block/revise with the missing screenshot proof.

Approval: approved by operator request on 2026-06-28. If the ticket plan changes
materially after this packet, return to goal-advisor and regenerate the packet.
```
