# TKT-017: Automations Dashboard

## Status

- state: `todo`
- owner: Farplane UI
- assignee:
- dependencies:
- location: `tickets/todo/TKT-017-automations-dashboard.md`
- enter when: reminders/monitors/wakeups exist outside the office UI
- leave when: automations render as first-party operations state with source-aware empty states
- blockers: automation source API may be tool-backed instead of repo-backed; Codex automation UI/source behavior needs inspection
- spawned follow-ups:
- complexity: `M`

## Description

Create `ui/src/modules/automations` for recurring reminders, monitors, wakeups,
and scheduled checks, but inspect how Codex itself renders/exposes automations
before locking the UI. The first slice should render available automation state
and clearly show when the source is unavailable in the browser runtime.

## Scope

- Directory: `ui/src/modules/automations`.
- Global view: all automations, next run, last result, owner, health.
- Team view: automations relevant to a project/team or tagged workspace.
- Source data: automation tool state if exposed, local artifacts, config files,
  or explicit unavailable state.

## UI Sketch

```text
Automations
+ Active + Due Soon + Failing + Unavailable Source +
Timeline | Recurring | Monitors | Wakeups | Logs
Team view: project automations + last run evidence
```

## Agent Contract

- Open: global launcher; linked from team/project context when scope exists.
- Test hook: fixture normalizer for automation rows.
- Stabilize: fixture active/due/failing/unavailable rows after source inspection.
- Inspect: status badges, next-run labels, source unavailable state.
- Key screens/states: active list, failing list, empty/unavailable source.
- QA cookbook: `qa/README.md`.
- Taste refs: operations schedule table, compact and scan-friendly.
- Expected artifacts: screenshot and normalizer test output.
- Delegate with: this ticket and FP01.

## Done / Proof

- [ ] Automations module exists with global entrypoint.
- [ ] Active/due/failing/unavailable states render.
- [ ] Team/project scoping is represented when metadata exists.
- [ ] No fake live automation claims are made when source is unavailable.
- [ ] Normalizer tests pass.
