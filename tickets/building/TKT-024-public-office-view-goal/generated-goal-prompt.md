---
ticket: TKT-024
title: Native Goal prompt
status: generated
created_at: 2026-06-14
---

# Native Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/building/TKT-024-public-office-view-goal/ticket.md
- tickets/building/TKT-024-public-office-view-goal/program.md
- tickets/building/TKT-024-public-office-view-goal/progress.md
- tickets/building/TKT-024-public-office-view-goal/generated-goal-prompt.md
- AGENTS.md
- PROJECT_RULES.md
- ARCHITECTURE.md
- qa/README.md
- ui/src/AppRouter.tsx
- ui/src/pages/OfficePage.tsx
- ui/src/shell/shell-config.ts
- ui/src/shell/FarplaneShell.tsx
- ui/src/modules/runtime/lib/adapters/contract.ts
- ui/src/modules/runtime/runtime-adapter-provider.tsx
- ui/src/modules/runtime/lib/adapters/factory.ts
- ui/src/providers/office-data-provider.tsx
- ui/src/providers/office-data-mapper.ts
- ui/src/components/office-simulation.tsx
- ui/src/components/hud/office-menu.tsx
- ui/src/components/hud/office-panel-registry.ts
- ui/src/components/hud/builder-toolbar.tsx
- ui/src/components/hud/furniture-shop.tsx
- ui/src/components/hud/user-tasks-panel.tsx
- ui/src/components/hud/ceo-task-detail-modal.tsx
- ui/src/components/hud/create-team-form.tsx
- ui/src/modules/chat/hooks/use-chat-messages.ts
- ui/src/modules/chat/hooks/use-chat-threads.ts
- ui/src/modules/office/components/agent-session-panel.tsx
- ui/src/modules/office/components/object-config-panel.tsx
- ui/src/modules/office/components/object-transform-panel.tsx
- ui/src/modules/office/hooks/use-delete-office-object.ts
- ui/src/modules/office/systems/placement-system.ts
- ui/src/modules/office/scene/office-layout-editor.tsx
- ui/src/modules/settings/settings-dialog.tsx
- ui/src/modules/settings/use-codex-office-visibility-settings.ts
- ui/src/modules/team-workspace/components/task-detail-modal.tsx

Task: Implement TKT-024. Create a livestream-safe public office view for
Farplane UI. Add a public/read-only office route such as `/office/public`, a
typed shell/access mode such as `accessMode: "operator" | "viewer" | "public"`,
and an app-level access mode context or equivalent helper. The public route
must render the office in read-only mode, preserve normal `/office` behavior,
block writes at the runtime adapter/provider boundaries, gate mutating UI
surfaces, and apply basic stream-safe redaction for obvious sensitive fields.

Logging: Before ending each turn, append a compact structured entry to
`tickets/building/TKT-024-public-office-view-goal/progress.md` with changed
files, verification, screenshots/artifacts, drift verdict, next action, and
blockers.

Metric: Satisfy the Done / Proof and Evidence Checklist in
`tickets/building/TKT-024-public-office-view-goal/ticket.md`. Mechanical checks
are not enough. Browser evidence is required for `/office/public`, visible
public/read-only mode, global menu/action gating, chat/session send controls
disabled or hidden, settings/builder/decor/object mutation controls disabled or
hidden, team/workbench/review approvals disabled or hidden, and blocked
mutation proof returning `readonly_mode`.

After each turn: Compare progress against the listed files and TKT-024 scope.
If the work expands into auth, invite links, remote deployment, full privacy
compliance, or unrelated UI redesign, stop and create a follow-up instead.
Continue within the current time/budget window while useful implementation or
proof work remains. Stop complete only when screenshots, checks, blocked-write
proof, provider read-only proof, and ticket reconciliation are recorded. Stop
blocked only after the same blocker repeats for three consecutive attempts and
one missing input or external condition is named.

Budget: one focused implementation window; subagents allowed for browser QA or
focused review; no spend; no deployment.
```
