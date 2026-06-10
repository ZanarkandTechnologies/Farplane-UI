# Feature: Farplane CLI

Farplane CLI is the operational surface for team topology and office state in this phase.

## Value

- Create and steer teams without editing raw JSON manually.
- Control heartbeat and role demand with explicit commands.
- Keep operations scriptable with `--json` output where supported.
- Expose one canonical monitoring feed for team runtime events and outputs.

## CLI Entry

```bash
farplane <command>
```

Fallback (if global CLI is not installed in the current environment):

```bash
npm run shell -- <command>
```

## Team Commands

```bash
farplane team list
farplane team config show --team-id team-proj-alpha --json
farplane team config resources init --team-id team-proj-alpha
farplane team monitor --team-id team-proj-alpha --json
farplane team create --name "Alpha" --description "Core team" --goal "Ship roadmap" --kpi weekly_shipped_tickets --auto-roles builder,pm,growth_marketer
farplane team update --team-id team-proj-alpha --goal "Reduce backlog" --kpi-add support_reply_sla_minutes
farplane team heartbeat set --team-id team-proj-alpha --cadence-minutes 15 --goal "Create or execute relevant tickets from Kanban"
farplane team heartbeat render --team-id team-proj-alpha --role biz_pm
farplane team run live --team-id team-proj-alpha --cadence-minutes 1 --goal "Live demo loop"
farplane team run test-mode --team-id team-proj-alpha --cadence-minutes 1 --goal "Fast demo loop"
farplane team role-slot set --team-id team-proj-alpha --role builder --desired-count 2
farplane team archive --team-id team-proj-alpha
farplane team archive --team-id team-proj-alpha --deregister-openclaw
```

`team create` now also provisions matching OpenClaw runtime agent entries plus bootstrap workspace/session directories so newly created team agents are immediately messageable.

## Business And Resource Commands

```bash
farplane team business get --team-id team-proj-affiliate --json
farplane team business set --team-id team-proj-affiliate --slot measure --skill-id stripe-revenue
farplane agent config show --agent-id affiliate-pm --json
farplane agent config set-skills --agent-id affiliate-executor --skills farplane-team-cli,status-self-reporter
farplane agent config set-heartbeat --agent-id affiliate-pm --cadence-minutes 1 --goal "Fast demo loop"
farplane agent monitor --agent-id affiliate-pm --json
farplane team resources list --team-id team-proj-affiliate --json
farplane team resources events --team-id team-proj-affiliate --limit 20 --json
farplane team resources reserve --team-id team-proj-affiliate --resource-id proj-affiliate:cash --amount 300
farplane team resources release --team-id team-proj-affiliate --resource-id proj-affiliate:cash --amount 100
farplane team resources remove --team-id team-proj-affiliate --resource-id proj-affiliate:custom
farplane team status report --team-id team-proj-affiliate --agent-id affiliate-pm --state planning --status-text "Reviewing board and KPIs" --step-key hb-affiliate-pm-001
farplane team bot log --team-id team-proj-affiliate --agent-id affiliate-pm --activity-type status --label heartbeat_decision --detail "Prioritize high-ROI creative test"
```

## Runtime Monitoring

The current MVP monitoring flow is:

1. Configure the team and agents.
2. Run through OpenClaw with `team run live` or `team run test-mode`.
3. Inspect the team through `team monitor`, `agent monitor`, and the per-team event log.

Canonical runtime paths:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/projects/<projectId>/logs/`
- `~/.openclaw/projects/<projectId>/outputs/`
- `~/.openclaw/workspace-<agentId>/HEARTBEAT.md`

`team monitor --json` now returns these paths plus the latest structured events so the UI can render one live feed instead of requiring separate bespoke debug surfaces.

## Office Commands

```bash
farplane office print
farplane office list
farplane office teams
farplane office add plant --position -10,0,-10
farplane office add plant --auto-place
farplane office add custom-mesh --auto-place --mesh-public-path /openclaw/assets/meshes/dragon.glb --display-name "Dragon"
farplane office add team-cluster --auto-place --metadata name=Dragons
farplane office doctor
farplane office doctor --reason missing_mesh_public_path
farplane office doctor --fix
farplane office move plant-nw --position 0,0,0
farplane office remove plant-nw
farplane office theme
farplane office theme set cozy
farplane office generate "small cactus desk plant" --style low-poly --type prop
```

## Validation And Automation

```bash
farplane doctor team-data
farplane team list --json
farplane doctor team-data --json
```

`doctor team-data` also validates resource integrity (duplicate resource IDs, missing tracker skill IDs, invalid limits, and resource events referencing missing resources).

## Source Of Truth

Commands mutate sidecar data:

- `~/.openclaw/company.json`
- `~/.openclaw/office-objects.json` (when office object metadata is split)

`office add` now supports either explicit coordinates (`--position`) or deterministic empty-space placement (`--auto-place`). Manual and auto flows both reject occupied positions to keep layout state collision-safe.

For UI parity:

- `custom-mesh` now requires mesh metadata (`--mesh-public-path` or equivalent metadata key) so objects render as real meshes instead of placeholders.
- `team-cluster` now auto-attaches to a real project-backed `team-<projectId>` mapping (creating/reviving a project if needed), so the cluster appears as a real team in UI panels.
- `office doctor` audits persisted office objects and reports invalid entries (for example custom meshes missing `meshPublicPath` or clusters mapped to missing/archived teams). Use `--reason <reason>` to target specific issue classes, and `office doctor --fix` to remove the current matched set.

When teams create agents, CLI also provisions OpenClaw runtime surfaces:

- `~/.openclaw/openclaw.json` (`agents.list` entries)
- `~/.openclaw/workspace-<agentId>/` (bootstrap workspace files)
- `~/.openclaw/agents/<agentId>/sessions/` (session store directories)

This is aligned with CLI-first invariants in `MEM-0119`, `MEM-0120`, and `MEM-0123`.

## Related Docs

- Intent cookbook: `docs/how-to/ceo-team-cli-scl-cookbook.md`
- Team CLI skill: `skills/farplane-team-cli/SKILL.md`
- Teams and heartbeats: `docs/public-docs/feature-teams-heartbeats.md`
- MVP config surface: `docs/public-docs/feature-mvp-team-config.md`
- Decorations: `docs/public-docs/feature-decorations.md`
- Personalization and custom meshes: `docs/public-docs/feature-personalization.md`
