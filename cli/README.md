# Farplane-UI Module CLI

## Purpose

Farplane-UI's module-local command implementations for onboarding, thin team operations, filesystem ticket workflow, office management, and local UI launch flows.

Farplane Core owns the global `farplane` command. This repo keeps the UI/office/team implementation surface and can be reached through Core delegation or through the module-local `farplane-ui` bin when working directly in this checkout.

## Public API / entrypoints

- `npm run cli -- <command>`
- `farplane <command>` through the Core CLI after `farplane ui link /path/to/Farplane-UI`
- `farplane-ui <command>` after `npm link` in this repo, for module-local development only
- `npm run cli:reinstall`
- `bash scripts/reinstall-cli.sh`

## Minimal example

```bash
npm run cli:reinstall
farplane ui link /path/to/Farplane-UI
farplane onboarding --yes
eval "$(farplane agent login --agent-id alpha-pm)"
farplane team list --json
farplane team config show --team-id team-proj-alpha --json
farplane team ticket list --team-id team-proj-alpha --json
```

## Current Command Families

- `onboarding`: first-run Farplane bootstrap on top of an already-onboarded OpenClaw install
- `ui`: launch the office UI
- `team`: team lifecycle, filesystem ticket flow, business config, monitoring, presets, resources, funds, heartbeat, and run helpers
- `agent`: agent config and runtime inspection
- `office`: office printing, layout objects, and decor/style control
- `doctor`: sidecar contract validation
- top-level `status`: shortcut for writing structured task/activity updates
- top-level `whoami`: inspect the resolved CLI caller for the current shell session

## Audit

The CLI currently exposes a large surface area. The highest-density groups are:

- `office`: many decor/layout commands that are useful but not core to the founder-control loop
- `team ticket`: filesystem task lifecycle commands that are core
- `team business`: business/team shaping commands with some MVP value and some drift
- review/planning work should happen directly on filesystem tickets instead of through a separate proposal namespace

The product direction is thinner than the current command count suggests.

### What Feels Canonical

- `onboarding`
- `ui`
- `team list`
- `team show`
- `team create`
- `team update`
- `team archive`
- `team config show`
- `team config resources get|set`
- `team monitor`
- `team ticket create|update|status|claim|priority|list`
- `team status report`
- `agent config show|set-skills|set-heartbeat`
- `agent login|logout`
- `agent monitor`
- `whoami`
- `doctor team-data`

### What Feels Optional Or At Risk

- proposal-specific command surfaces instead of direct ticket planning/review flow
- large preset/business helper surfaces that create product-specific structure before it is proven necessary
- office decor/style command depth beyond basic demo/operator needs

## Canonical State Model

Farplane should stay thin and inspectable.

- Filesystem tickets keep the minimal structure needed for routing and execution:
  `ticket_id`, project path, status, priority, ownership, timestamps, approval/session metadata.
- The actual working content for a task or project should default to markdown text.
- Project/task history should remain append-only and auditable.
- Agents should be able to replace or extend the current markdown body as the latest working state, while the event log preserves the trail.

In practice, this means:

- keep structured frontmatter for ticket mechanics and session linkage
- keep rich project/task content in markdown bodies, not sprawling JSON contracts
- keep append-only logs under the sidecar root as the durable execution history

## Simplification Direction

The module CLI simplification target is:

1. Keep structure around filesystem tickets.
2. Prefer markdown files or markdown bodies for task/project working state.
3. Prefer append-only logs for history.
4. Avoid introducing proposal-specific stores when a ticket plus markdown body can carry the workflow.
5. Treat `team config`, `agent config`, `team monitor`, `farplane status`, and `team ticket` as the core operator loop.

This matches the current file-backed resource model and the append-only event stream already used by team monitoring.

## Recommended MVP Surface

If you are building against the current product direction, start with:

- `farplane onboarding`
- `farplane ui`
- `farplane team list`
- `farplane team create`
- `farplane team config show`
- `farplane team config resources get`
- `farplane team config resources set`
- `farplane team ticket create`
- `farplane team ticket update`
- `farplane team ticket status`
- `farplane team ticket memory set`
- `farplane team ticket memory append`
- `farplane team ticket claim`
- `farplane team ticket list`
- `farplane team monitor`
- `farplane agent config show`
- `farplane agent config set-skills`
- `farplane agent config set-heartbeat`
- `farplane agent monitor`

## Example Workflow

```bash
farplane ui link /path/to/Farplane-UI
farplane onboarding --yes
eval "$(farplane agent login --agent-id affiliate-lab-pm)"
farplane whoami
farplane ui
farplane team create --name "Affiliate Lab" --description "Small affiliate loop" --goal "Publish and learn"
farplane team config resources set --team-id team-proj-affiliate-lab --text $'# Resources\n\nbudget: small\nconstraints: stay text-first\n'
farplane team ticket create --team-id team-proj-affiliate-lab --title "Draft execution brief" --detail $'Goal: turn the approved idea into a working markdown brief.\n\nNext:\n- define first KPI\n- define first content batch'
farplane team ticket memory append --team-id team-proj-affiliate-lab --ticket-id TASK-0001 --text $'## Plan\n- gather context\n- draft first KPI\n- move to review'
farplane status --state planning "Triaging approved work"
farplane team ticket status --team-id team-proj-affiliate-lab --ticket-id TASK-0001 --status review
farplane team monitor --team-id team-proj-affiliate-lab --json
```

## Session Identity

Agent-attributed CLI commands should run inside a shell session that has a caller identity claim.

```bash
eval "$(farplane agent login --agent-id alpha-pm)"
farplane whoami --json
farplane status --state planning "Starting my turn"
farplane agent logout
```

Farplane treats `FARPLANE_AGENT_ID` as the canonical caller identity for agent-attributed writes, then derives `teamId`, `projectId`, and role from `company.json`. Conflicting manual `FARPLANE_TEAM_ID` or `FARPLANE_PROJECT_ID` overrides fail fast.

## How To Think About Task State

- Use ticket frontmatter for status, owner, and routing.
- Use the task title plus markdown detail/body for the current working memory.
- Use the project event log for the append-only execution trail.
- Do not assume every new workflow needs a new structured object model.

## How to test

```bash
npm run test:once -- cli/cli-install.test.ts cli/onboarding-commands.test.ts cli/team-commands.test.ts
```
