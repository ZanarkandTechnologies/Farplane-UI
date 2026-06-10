# Feature: MVP Team Config

This is the reduced MVP surface for configuring and testing autonomous teams in Farplane.

## Why Simplify

We do not need a large preset system or a second backend config layer to test autonomous teams.

For the current demo and local/VPS product shape, the useful loop is smaller:

1. Configure the team.
2. Configure the agents.
3. Speed up the run/test loop.
4. Monitor what happened.

That shape is easier to teach, easier to audit, and faster to iterate on than a heavily opinionated preset with many fields.

## The MVP Surface

### Team config

Team config should answer:

- what this team is trying to do
- who belongs to it
- what roles are expected
- what resources or constraints exist

Farplane now exposes this through:

```bash
farplane team config show --team-id team-proj-alpha --json
farplane team config resources init --team-id team-proj-alpha
farplane team config resources get --team-id team-proj-alpha
farplane team config resources set --team-id team-proj-alpha --text "# Resources ..."
```

### Why resources are file-backed for now

Resources are intentionally stored in `RESOURCES.md` under the OpenClaw sidecar root instead of a separate database form.

That choice is deliberate:

- markdown is easy for operators and agents to inspect
- diffs are obvious
- editing is simple
- auditability is better than hidden form state
- this keeps the MVP local-first and reversible

The file path is:

- `~/.openclaw/projects/<projectId>/RESOURCES.md`

### Agent config

Agent config should answer:

- what role this agent owns
- which skills it can use
- what heartbeat profile it follows
- where its workspace lives

Farplane now exposes this through:

```bash
farplane agent config show --agent-id alpha-pm --json
farplane agent config set-skills --agent-id alpha-builder --skills farplane-team-cli,status-self-reporter
farplane agent config set-heartbeat --agent-id alpha-pm --cadence-minutes 1 --goal "Fast demo loop"
farplane agent monitor --agent-id alpha-pm --json
```

Per-agent heartbeat edits create a dedicated agent heartbeat profile so one debug tweak does not silently mutate every other agent sharing a default profile.

### Run / test

The MVP does not need a separate run engine. OpenClaw is the run engine. Farplane should only make it easy to retune the real heartbeat and inspect the runtime state.

Farplane now exposes:

```bash
farplane team run show --team-id team-proj-alpha --json
farplane team run live --team-id team-proj-alpha --cadence-minutes 1 --goal "Live demo loop"
farplane team run test-mode --team-id team-proj-alpha --cadence-minutes 1 --goal "Fast demo loop"
```

This keeps the loop straightforward:

- lower the real cadence
- leave the gateway running
- inspect the actual team workspaces and heartbeat config
- restore later if needed

### Monitor

Monitoring should stay readable. The operator mainly needs:

- team goal
- current agents
- role slots
- heartbeat profiles
- cron jobs
- resources file state
- OpenClaw config path
- workspace paths
- `HEARTBEAT.md` paths
- current OpenClaw heartbeat cadence per agent
- canonical event log path
- recent structured events

Farplane now exposes:

```bash
farplane team monitor --team-id team-proj-alpha --json
farplane agent monitor --agent-id alpha-pm --json
```

The canonical monitoring files are now:

- `~/.openclaw/projects/<projectId>/logs/`
- `~/.openclaw/projects/<projectId>/outputs/`

Farplane appends structured events for:

- live/test heartbeat cadence changes
- task lifecycle changes
- status reports
- activity logs

This keeps the MVP monitoring model simple: one append-only event stream, then richer UI renderers can be layered on top later.

## What This Means For The Product

The MVP model is now:

- `team config`
- `agent config`
- `team run`
- `monitor`

Presets can still exist as bootstrapping helpers, but they should not be the main mental model, and Farplane should not maintain a second simulated runtime alongside OpenClaw.

The main mental model is explicit configuration plus fast iteration.

## Related Docs

- [feature-cli.md](./feature-cli.md)
- [feature-teams-heartbeats.md](./feature-teams-heartbeats.md)
- [architecture.md](./architecture.md)
