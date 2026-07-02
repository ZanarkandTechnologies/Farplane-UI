---
kind: project-automation-reference
status: reference
project: Farplane UI
created_at: 2026-06-17
updated_at: 2026-06-26
framework_template_version: "0.1.0"
owner: project-pm-automation
---

# Codex PM Heartbeat Bandit

## Summary

The PM idle loop should not be an idle animation brain. It should be a useful
Codex-native heartbeat that wakes on cadence, learns from previous work, chooses
one next founder/PM action, and spawns a bounded child Codex thread to do that
work.

The loop is:

```text
observe previous work
  -> update rewards
  -> reflect briefly
  -> choose next action
  -> spawn one child Codex thread
  -> record expected outputs and reward horizon
```

Codex owns the heartbeat schedule. Farplane owns the local project contract,
state files, reward policy, and action tree.

## Goals

- Make persistent PM agents useful every cadence without polluting one long
  planning thread.
- Keep local project files as the durable source of truth.
- Let the PM explore different action lanes while gradually exploiting lanes
  that produce better outcomes.
- Keep each child thread bounded, named, inspectable, and tied to expected
  outputs.
- Avoid using `farplane status` as the main contract. Progress should come from
  files, spawned thread records, artifacts, metrics, and reward ledgers.

## Non-Goals

- Do not build a custom scheduler when Codex native heartbeats already exist.
- Do not make this a Farplane CLI product surface.
- Do not merge this with the old `biz_pm` / `biz_executor` heartbeat model.
- Do not use MCTS in the first version; the reward surface is not rich enough
  for a good simulator yet.
- Do not let the PM drain every ticket directly. Ticket execution is one action
  lane among several.

## State Surfaces

The heartbeat should keep local project state under a project-owned directory:

```text
.farplane/automation/
  heartbeat-policy.json
  action-arms.json
  bandit-state.json
  decisions.jsonl
  spawned-threads.jsonl
  action-outcomes.jsonl
  rewards.jsonl
  metric-snapshots.jsonl
  reflections/latest.md
```

Recommended responsibilities:

```text
heartbeat-policy.json
  cadence, enabled flag, max open child threads, allowed actions, gates

action-arms.json
  action definitions, labels, prompt hints, expected outputs, base weights

bandit-state.json
  pulls, reward totals, rewarded snapshot ids, last selected times

decisions.jsonl
  one row per heartbeat decision

spawned-threads.jsonl
  child thread id, title, expected outputs, status

action-outcomes.jsonl
  reconciled result of previous child work

rewards.jsonl
  reward events from outcomes and metric snapshots

metric-snapshots.jsonl
  daily/weekly business/product metrics

reflections/latest.md
  compact current reflection for the next spawned child
```

## PM Action Tree

```text
PM Heartbeat Action
├─ Ticket Execution
│  ├─ pick highest-value ready local ticket
│  ├─ run planning if stale
│  ├─ spawn child thread to execute ticket
│  └─ record expected evidence/progress paths
├─ Planning
│  ├─ replan roadmap
│  ├─ clarify vague tickets
│  ├─ split oversized tickets
│  ├─ identify missing systems
│  └─ write follow-up tickets
├─ Growth Research
│  ├─ user acquisition strategy
│  ├─ marketing channel research
│  ├─ competitor/peer scouting
│  ├─ pricing/positioning notes
│  └─ measurable growth experiment proposal
├─ Product Quality
│  ├─ QA app workflow
│  ├─ inspect fragile UX
│  ├─ write bug tickets
│  ├─ improve docs
│  └─ harden public/user-facing proof
├─ Skill Hardening
│  ├─ improve skill instructions
│  ├─ add gotchas
│  ├─ add tests/evals
│  ├─ simplify duplicated guidance
│  └─ update skill memory
├─ Eval Writing
│  ├─ add deterministic eval
│  ├─ add regression check
│  ├─ improve QA harness
│  └─ create proof artifact
├─ Automation Building
│  ├─ identify repeated manual workflow
│  ├─ write automation spec
│  ├─ add script/heartbeat candidate
│  └─ create implementation ticket
├─ Reward Update
│  ├─ reconcile prior child threads
│  ├─ apply metric snapshots
│  ├─ update bandit state
│  └─ write reflection
├─ Metric Snapshot
│  ├─ capture daily views/subscribers/replies
│  ├─ capture weekly profit/paid users/retention
│  └─ append metric-snapshots.jsonl
└─ Weekly Reflection
   ├─ summarize past decisions
   ├─ compare rewards by lane
   ├─ adjust strategy
   └─ update goals/tickets/reports
```

## Heartbeat Policy

The policy defines the sandbox the bandit chooses inside:

```json
{
  "automationId": "farplane-ui-founder-heartbeat",
  "enabled": true,
  "cadenceMinutes": 30,
  "maxSpawnedThreadsPerBeat": 1,
  "maxOpenSpawnedThreads": 5,
  "allowedActions": [
    "ticket_execution",
    "planning",
    "growth_research",
    "skill_hardening",
    "eval_writing",
    "qa_app",
    "automation_building",
    "reward_update"
  ],
  "forcedActions": {
    "metricSnapshotMaxAgeHours": 24,
    "weeklyReflectionMaxAgeDays": 7,
    "maxUnreconciledThreads": 5
  },
  "gates": [
    "no_push",
    "no_deploy",
    "no_publish",
    "no_spend",
    "no_account_changes",
    "no_destructive_cleanup"
  ]
}
```

Forced actions override the bandit. For example:

```text
if too many unreconciled child threads:
  choose reward_update
else if metric snapshots are stale:
  choose metric_snapshot
else if weekly reflection is stale:
  choose weekly_reflection
else:
  use bandit
```

## Bandit Algorithm

Start with a contextual multi-armed bandit using UCB or Thompson sampling.
UCB is easiest for the first version because it is deterministic and simple to
debug.

Each action lane is an arm:

```text
ticket_execution
planning
growth_research
skill_hardening
eval_writing
qa_app
automation_building
reward_update
metric_snapshot
weekly_reflection
```

UCB score:

```text
score(arm) =
  mean_reward(arm)
  + exploration_bonus(arm)
  + base_weight(arm)
  + context_boost(arm)
```

Where:

```text
mean_reward = total_reward / pulls
exploration_bonus = sqrt(2 * ln(total_pulls + 1) / (pulls + 1))
base_weight = product preference for this lane
context_boost = temporary pressure from current project state
```

Example context boosts:

```text
ticket_execution +0.35 when open tickets exist
planning         +0.25 when many tickets are stale/vague
reward_update    +0.20 when unreconciled child threads exist
growth_research  +0.10 when growth has not run recently
```

The selected mode should be recorded:

```text
explore = arm has no or very few samples
exploit = arm has best current score
forced  = policy override selected the action
```

## Reward Calculation

Reward update should happen before the next decision:

```text
heartbeat starts
  -> inspect previous child threads
  -> inspect metric snapshots
  -> apply rewards
  -> update bandit state
  -> choose next action
```

Use three reward horizons.

### Immediate Reward

Immediate rewards come from local work proof:

```text
+ ticket progress changed
+ expected artifact created
+ docs updated
+ eval added
+ child thread completed
+ useful follow-up ticket created
- child blocked
- no expected output changed
- duplicate/noisy work
```

Suggested values:

```text
completed useful child task: +0.50
partial artifact/progress:  +0.25
blocked with useful reason: +0.05
no signal after window:      0.00
duplicate/noisy output:     -0.20
```

### Daily Reward

Daily rewards come from short-horizon product/growth metrics:

```text
views
subscribers
qualified replies
clicks
trial starts
issue activity
community mentions
```

Daily metrics steer the system quickly but should be lower confidence than
weekly business metrics.

### Weekly Reward

Weekly rewards carry heavier business weight:

```text
profit
paid users
retention
conversion
sales calls
activation
shipping velocity
strategic milestone progress
```

Avoid double-counting weekly and daily signals. Either:

```text
weekly_adjustment = weekly_actual - daily_rewards_already_attributed
```

or treat weekly snapshots as higher-confidence correction events rather than
independent full rewards.

## Reward Scalar

For an early product/founder loop:

```text
reward =
  0.45 * normalized_profit_delta
+ 0.20 * subscriber_delta
+ 0.15 * qualified_attention_delta
+ 0.10 * shipped_asset_value
+ 0.10 * strategic_system_improvement
- cost_penalty
- duplicate_work_penalty
```

The weights should be project-specific and live in policy/config.

## Decision Record

Each heartbeat appends a decision row:

```json
{
  "decisionId": "hb-farplane-ui-founder-heartbeat-2026-06-20T10-00",
  "automationId": "farplane-ui-founder-heartbeat",
  "actionId": "growth_research",
  "mode": "explore",
  "reason": "Growth research has high uncertainty and user-priority boost.",
  "score": 2.17,
  "context": {
    "openTicketCount": 12,
    "unreconciledThreadCount": 0,
    "lastActionId": "ticket_execution"
  },
  "expectedRewardHorizon": "daily_weekly",
  "expectedOutputs": [
    ".farplane/reports/growth",
    "tickets"
  ],
  "createdAt": "2026-06-20T10:00:00.000Z"
}
```

## Child Thread Contract

The heartbeat should spawn exactly one child Codex thread per beat unless a
forced maintenance action does not need a child.

Child prompt should include:

```text
Thread name
Action lane
Objective
Project root
Context refs
Recent reflection
Allowed gates
Expected outputs
Stop condition
Instruction not to use farplane status as the primary progress channel
```

Example:

```text
Thread name: [Farplane] Growth research: acquisition experiment

Action: growth_research
Objective: Find one measurable user acquisition experiment for Farplane.

Files:
- farplane/goals.md
- farplane/automations.toml
- .farplane/automation/reflections/latest.md
- tickets/

Expected outputs:
- .farplane/reports/growth/runs/YYYY-MM-DD-HHMM.md
- one ticket update or new ticket if actionable

Gates:
- no_push
- no_deploy
- no_spend

Stop:
Stop after one useful artifact or a clear blocker.
```

## Automation Implementation

Codex native heartbeat owns the cadence. The project automation file should
define the contract:

```text
settings {
  founder_heartbeat {
    automation_id: farplane-ui-founder-heartbeat
    kind: heartbeat
    schedule: "FREQ=MINUTELY;INTERVAL=30"
    runner: "Codex native heartbeat"
    command: "npx tsx scripts/codex-automation-heartbeat.ts run --project-root . --automation-id farplane-ui-founder-heartbeat"
    max_spawned_threads_per_beat: 1
  }
}
```

The actual Codex automation/heartbeat should be created from this contract.
Farplane should not implement a second scheduler.

## Open Questions

- What exact Codex native heartbeat configuration file/API should be generated
  from `farplane/automations.toml`?
- Should reward updates happen inside every heartbeat, or should there be a
  separate daily/weekly metric heartbeat?
- How should the child thread title be set if Codex native thread title APIs are
  limited?
- Which metrics are available per project and how are they normalized?
- Should the PM heartbeat ever skip spawning a child thread after a reward-only
  maintenance beat?

## Recommended First Slice

1. Keep `farplane/automations.toml` as the parseable automation config contract.
2. Create a Codex native heartbeat from `settings.founder_heartbeat`.
3. On each beat, run the local program:

```text
observe -> reward -> reflect -> decide -> spawn -> record
```

4. Start with UCB bandit.
5. Store all state in `.farplane/automation/`.
6. Add real metric snapshots later; begin with local immediate rewards from
   artifacts, ticket progress, and child-thread outcomes.
