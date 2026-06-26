---
kind: project-automations
status: active
project: Farplane UI
created_at: 2026-06-17
updated_at: 2026-06-26
framework_template_version: "0.4.0"
owner: automation-advisor
source_of_truth:
  - farplane/harness.md
  - farplane/products.md
  - farplane/pm.json
---

# Farplane UI Automations

This file stores the exact Codex automation prompt blocks for the project.
Prompts configure cadence, project root, thread IDs, and project-specific
extensions only. Reusable loop behavior lives in `pulse-update` and
`interval-update`.

## Pulse

| Field | Value |
| --- | --- |
| Automation id | `farplane-ui-pulse` |
| Name | `Farplane UI Pulse` |
| Kind | `heartbeat` |
| RRULE | `FREQ=MINUTELY;INTERVAL=30` |
| Target thread | `019ef4a0-5f28-7f51-b682-a44114bf2b0b` |

```text
Run one Farplane UI Pulse beat.

Call:
- `pulse_update(project_root="/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI")`

Project context:
- read `farplane/harness.md` to preserve the static human thesis and authority
  boundaries.
- read `farplane/products.md` when shaping product refill tickets.

Project extensions:
- product refill tickets should name the project type, baseline or comparison
  point, expected artifact, and proof signal.
- distribution/content tickets are allowed when they showcase a real Farplane
  UI product row or feature and name a feedback signal.
- favor local ready/unblocked tickets before creating new work.

Project gates:
- select at most one bounded action per beat.
- no separate ticket-drainer automation is required.
- substantial implementation routes through `harness-creator` first when the
  operating model is missing, then `goal-advisor` only after a concrete
  milestone exists.
- no push, deploy, publish, spend, account changes, external mutation, or
  destructive cleanup.
- no shady growth, fake engagement, privacy-invasive analytics, or content that
  misrepresents what agents or Farplane did.
- no drift review, broad strategy replanning, or unbounded worker spawning.

Final output:
- execution mode
- reward updates
- child thread IDs or planning request
- report/state paths
- evidence that will decide the next reward update
```

## Daily Interval

| Field | Value |
| --- | --- |
| Automation id | `farplane-ui-daily-interval` |
| Name | `Farplane UI Daily Interval` |
| Kind | `cron` |
| RRULE | `FREQ=DAILY;BYHOUR=5;BYMINUTE=33;BYSECOND=0` |
| Workspace | `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI` |

```text
Run the Farplane UI Daily Interval.

Call:
- `interval_update(project_root="/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI", interval_id="daily_interval", review_window="last_24h", planning_window="next_24h", timezone="Asia/Kuala_Lumpur")`

Project context:
- read the latest `weekly_interval` report when it exists.
- read `farplane/harness.md`, `farplane/products.md`, `farplane/goals.md`, and
  active `tickets/TASK-*/ticket.md` files.

Project workflows:
- `plan_progress`: light.
- `goal_drift`: light.
- `ticket_board_drift`: light.
- `product_refill`: when local ready work is thin.
- `distribution_refill`: when there are no current content/demo tickets tied to
  viral agent-office or feature-showcase products.

Project gates:
- report before mutation.
- source gaps instead of guessed refs.
- no scheduler state writes.
- no push, deploy, publish, spend, external mutation, commit, unbounded worker
  spawning, or destructive cleanup.

Final output:
- dated report path
- next-24-hour plan
- Pulse guidance
- proposed ticket deltas or Goal Advisor handoffs
- approval-required goals delta, if any
```

## Weekly Interval

| Field | Value |
| --- | --- |
| Automation id | `farplane-ui-weekly-interval` |
| Name | `Farplane UI Weekly Interval` |
| Kind | `cron` |
| RRULE | `FREQ=WEEKLY;BYDAY=MO;BYHOUR=5;BYMINUTE=45;BYSECOND=0` |
| Workspace | `/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI` |

```text
Run the Farplane UI Weekly Interval.

Call:
- `interval_update(project_root="/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI", interval_id="weekly_interval", review_window="last_week", planning_window="next_week", timezone="Asia/Kuala_Lumpur")`

Project context:
- read all `daily_interval` reports inside `last_week`.
- read `farplane/harness.md`, `farplane/products.md`, `farplane/goals.md`,
  `docs/bootstrap-brief.md`, and active tickets.

Project workflows:
- `plan_progress`: true.
- `codex_attention_drift`: true.
- `ticket_board_drift`: true.
- `feedback_obligations`: when sources exist.
- `opportunity_signals`: when sources exist.
- `goal_drift`: true.
- `metric_snapshot`: when sources exist.
- `compounding_leverage_review`: true.
- `docs_consolidation`: when sources exist.
- `priority_planning`: true.
- `distribution_planning`: true.

Project gates:
- report before mutation.
- approval required for static charter, north-star, KPI, strategy-axis,
  quarterly/yearly, durable milestone, and hold changes.
- urgent leverage escalation requires high confidence, explicit loss term,
  evidence refs, review-by date, and owner route.
- source gaps instead of guessed refs.
- no scheduler state writes.
- no shady growth, fake engagement, privacy-invasive analytics, or content that
  misrepresents what agents or Farplane did.
- no push, deploy, publish, spend, external mutation, commit, unbounded worker
  spawning, or destructive cleanup.

Final output:
- dated report path
- next-week plan
- lane distribution and ticket budget
- Pulse guidance
- proposed ticket deltas or Goal Advisor handoffs
- approval-required goals delta, if any
- leverage decisions and reward closure
```
