---
kind: project-automations
status: draft
project: Farplane UI
created_at: 2026-06-17
updated_at: 2026-06-17
framework_template_version: "0.1.0"
owner: project-pm-automation
ledger: .farplane/state/run-ledger.json
bindings: farplane/bindings.md
---

# Project Automations

This file defines the project's recurring automation program.
Live Codex automation prompts should be compiled from this file, but each live
prompt should still carry its exact program and todo list.

```project-automation
project {
  id: farplane-ui
  root: "."
  mission: "Build and maintain the local founder-control office for AI work."
  default_board_policy: local_first
  ledger: ".farplane/state/run-ledger.json"
  bindings: "farplane/bindings.md"
  ticket_sources {
    local {
      enabled: true
      path: "tickets/"
      priority: first
    }
    notion {
      enabled: false
      binding_ref: "notion"
      project_id: null
      project_name: "Farplane UI"
      statuses: ["Not started", "In Progress"]
      use_when: "local has no proceedable ticket and notion.enabled is true"
    }
  }
  gates: [
    no_push,
    no_deploy,
    no_publish,
    no_spend,
    no_account_changes,
    no_destructive_cleanup
  ]
}

settings {
  founder_heartbeat {
    automation_id: farplane-ui-founder-heartbeat
    kind: heartbeat
    schedule: "FREQ=MINUTELY;INTERVAL=30"
    runner: "Codex native heartbeat"
    command: "npx tsx scripts/codex-automation-heartbeat.ts run --project-root . --automation-id farplane-ui-founder-heartbeat"
    dry_run_command: "npx tsx scripts/codex-automation-heartbeat.ts run --project-root . --automation-id farplane-ui-founder-heartbeat --dry-run --json"
    max_spawned_threads_per_beat: 1
  }
}

reports {
  update_external_context.latest: ".farplane/reports/external-context/latest.md"
  update_external_context.runs: ".farplane/reports/external-context/runs/"
  update_memory.latest: ".farplane/reports/memory/latest.md"
  update_memory.runs: ".farplane/reports/memory/runs/"
  skill_hardening.latest: ".farplane/reports/skill-maintenance/harden-latest.md"
  skill_hardening.runs: ".farplane/reports/skill-maintenance/runs/"
  skill_refinement.latest: ".farplane/reports/skill-maintenance/refine-latest.md"
  skill_refinement.runs: ".farplane/reports/skill-maintenance/runs/"
  registry_drift.latest: ".farplane/reports/registry-drift/latest.md"
  registry_drift.runs: ".farplane/reports/registry-drift/runs/"
  update_strategy.latest: ".farplane/reports/strategy/latest.md"
  update_strategy.runs: ".farplane/reports/strategy/runs/"
  ticket_update.latest: ".farplane/reports/ticket-update/latest.md"
  ticket_update.runs: ".farplane/reports/ticket-update/runs/"
  weekly_pm.latest: ".farplane/reports/weekly-pm/latest.md"
  weekly_pm.runs: ".farplane/reports/weekly-pm/runs/"
}

state automation_heartbeat {
  policy: ".farplane/automation/heartbeat-policy.json"
  action_arms: ".farplane/automation/action-arms.json"
  bandit_state: ".farplane/automation/bandit-state.json"
  decisions: ".farplane/automation/decisions.jsonl"
  spawned_threads: ".farplane/automation/spawned-threads.jsonl"
  action_outcomes: ".farplane/automation/action-outcomes.jsonl"
  rewards: ".farplane/automation/rewards.jsonl"
  metric_snapshots: ".farplane/automation/metric-snapshots.jsonl"
  reflection_latest: ".farplane/automation/reflections/latest.md"
}

job update_external_context {
  intent: "ground project planning in fresh external context"
  skill: feed-scout
  freshness: 24h
  writes: [
    ".farplane/reports/external-context/latest.md",
    ".farplane/reports/external-context/runs/YYYY-MM-DD.md"
  ]
}

job update_memory {
  intent: "consolidate durable project context and docs without mixing in skill hardening"
  skill: update-memory
  freshness: 7d
  reads: [
    "docs/HISTORY.md",
    "docs/MEMORY.md",
    "docs/LESSONS.md",
    "docs/TROUBLES.md",
    "relevant docs/**/*.md",
    "README.md",
    "recent tickets and artifacts"
  ]
  writes: [
    ".farplane/reports/memory/latest.md",
    ".farplane/reports/memory/runs/YYYY-MM-DD.md",
    "proposed README/docs/MEMORY/HISTORY/LESSONS/TROUBLES deltas when justified",
    "docs consolidation tickets when justified"
  ]
  output: "context report with accepted deltas, proposed doc deltas, docs consolidation plan, stale context, and blockers"
}

job skill_hardening {
  intent: "turn fresh lessons and troubles into evals, gotchas, guardrails, or tickets"
  skill: "skill-maintenance(mode: harden_skill)"
  freshness: 7d
  writes: [
    ".farplane/reports/skill-maintenance/harden-latest.md",
    ".farplane/reports/skill-maintenance/runs/YYYY-MM-DD-harden.md"
  ]
}

job skill_refinement {
  intent: "compact older evals and gotchas after hardening exists"
  skill: "skill-maintenance(mode: refine_skill)"
  freshness: 7d
  writes: [
    ".farplane/reports/skill-maintenance/refine-latest.md",
    ".farplane/reports/skill-maintenance/runs/YYYY-MM-DD-refine.md"
  ]
}

job registry_drift {
  intent: "keep skill/source/feature registries aligned with current repo state"
  skill: skill-maintenance
  freshness: 7d
  reads: [
    "docs/skills/registry.jsonl",
    "docs/features/registry.jsonl",
    "docs/sources/registry.jsonl",
    "skills/*/SKILL.md"
  ]
  writes: [
    ".farplane/reports/registry-drift/latest.md",
    ".farplane/reports/registry-drift/runs/YYYY-MM-DD.md",
    "registry patches or follow-up tickets"
  ]
}

job update_strategy {
  intent: "refresh strategy, current milestone, tickets, and system gaps"
  skill: update-strategy
  freshness: 7d
  depends_on: [
    "update_external_context:max_age=24h",
    "update_memory:max_age=7d",
    "skill_hardening:max_age=7d",
    "registry_drift:max_age=7d"
  ]
  writes: [
    ".farplane/reports/strategy/latest.md",
    ".farplane/reports/strategy/runs/YYYY-MM-DD.md",
    "local ticket deltas"
  ]
}

job ticket_update {
  intent: "pick and advance the highest-value autonomous ticket"
  skills: [impl-plan, goal-advisor]
  freshness: none
  reads: [
    "tickets/README.md",
    "tickets/TASK-*/ticket.md",
    "notion tasks only when ticket_sources.notion.enabled is true, local has no proceedable ticket, and farplane/bindings.md has a usable notion binding"
  ]
  writes: [
    ".farplane/reports/ticket-update/latest.md",
    ".farplane/reports/ticket-update/runs/YYYY-MM-DD-HHMM.md",
    "selected ticket progress/evidence/blockers"
  ]
}

cadence founder_heartbeat {
  automation_id: farplane-ui-founder-heartbeat
  config_ref: settings.founder_heartbeat
  todo: [
    "load heartbeat policy and local automation ledgers",
    "reconcile prior spawned child threads using expected output paths",
    "apply unrewarded metric snapshots to bandit rewards",
    "write a compact reflection from recent outcomes and project pressure",
    "choose one forced maintenance action or one bandit action",
    "build a named child Codex prompt with context refs, gates, expected outputs, and stop condition",
    "spawn one child Codex thread through the Codex app-server bridge unless dry-run",
    "record decision, spawned thread, outcomes, rewards, and reflection under .farplane/automation"
  ]
}

legacy cadence daily_ticket_drainer {
  replaced_by: founder_heartbeat
  note: "Ticket draining is now one possible action selected by the 30-minute parent heartbeat. Child threads do not rename themselves."
}

legacy cadence weekly_pm_update {
  replaced_by: founder_heartbeat
  note: "Weekly strategy reflection is now a forced or bandit-selected action lane with weekly reward weighting."
}
```

## Compiled Prompt Rule

Each live automation prompt should include:

- `Program:` fenced as `automation-program`
- `Todo:` exact ordered steps
- explicit side-effect gates
- required final output fields

Do not leave the live prompt as only "read `farplane/automations.md` and decide."
