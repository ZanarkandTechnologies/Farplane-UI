---
name: farplane_kanban_ops
description: Internal Kanban operations skill for agent task execution and status reporting through Farplane CLI.
---

# Farplane Kanban Ops Skill

Use this skill when an agent should only operate filesystem tickets and report progress, not perform full team administration.

## Entry Command

Run from Farplane repo root:

```bash
npm run shell -- <command>
```

## Core Loop

1. Pull queue state:

```bash
npm run shell -- team ticket list --team-id team-proj-<slug> --json
```

1. Claim/update task:

```bash
npm run shell -- team ticket claim --team-id team-proj-<slug> --ticket-id <ticketId> --agent-id <agentId>
npm run shell -- team ticket status --team-id team-proj-<slug> --ticket-id <ticketId> --status in_progress
```

1. Log progress/status:

```bash
export FARPLANE_AGENT_ID=<agentId>
export FARPLANE_TEAM_ID=team-proj-<slug>

npm run shell -- status \
  --state executing \
  --task-id <ticketId> \
  --step-key <idempotencyKey> \
  "Execution update: what changed"
```

1. Finish or block:

```bash
npm run shell -- team ticket status --team-id team-proj-<slug> --ticket-id <ticketId> --status done --note "completed output"
npm run shell -- team ticket status --team-id team-proj-<slug> --ticket-id <ticketId> --status blocked --reason "blocked reason"
```

## Full Internal Ticket Command Set

- Create: `team ticket create`
- Update fields: `team ticket update`
- Move status: `team ticket status`
- Assign owner: `team ticket claim`
- Reprioritize: `team ticket priority`
- Block/unblock: `team ticket status --status blocked`, `team ticket status --status in_progress`
- Complete: `team ticket status --status done`
- List: `team ticket list`
- Timeline: `farplane status` plus `team monitor`

## Permission-Aware Execution

Use least-privilege role/permissions:

- `FARPLANE_ACTOR_ROLE` (example: `biz_executor`)
- `FARPLANE_ALLOWED_PERMISSIONS` (example: `team.read,team.ticket.write,team.activity.write`)

If denied, CLI returns:

- `permission_denied:<permission>:role=<role>`

## Safety

- Always include `--team-id`.
- Use `--json` when output is consumed by another tool.
- Use `status` with `FARPLANE_AGENT_ID` + `FARPLANE_TEAM_ID` exported in-shell.
- Use `--step-key` for idempotent status logs.
- Prefer `ticket update` over delete/recreate so history stays auditable.
