---
ticket_id: TASK-0009
program_id: TASK-0009-office-runtime-debugging-loop
status: proof
created_at: 2026-06-24
updated_at: 2026-06-24
---

# Program: Office Runtime Debugging Loop

## Loop Shape
- `type:` active_goal
- `round_cap:` 3 runtime-debugging councils
- `round_owner:` Codex parent agent synthesizes; councils are read-only unless
  explicitly assigned a disjoint patch task.
- `stop_when:` no new high-confidence in-scope bugs remain, all accepted fixes
  have focused tests, or 3 rounds complete.

## Budget
- `time:` current turn as far as feasible.
- `subagents:` up to 5 read-only runtime-debugging lanes per council round.
- `review:` synthesize lane outputs before patching; do not patch speculative
  findings without file evidence.
- `qa:` focused Vitest and root typecheck every patch batch; browser proof when
  visible renderer behavior changes and a server can be used.
- `spend:` no external paid services.

## Metric / Feedback Provider
- `mechanical:` focused tests and typecheck pass.
- `review:` council findings are evidence-backed and de-duplicated.
- `visual:` browser proof or recorded blocker for scene-visible changes.

## Drift Policy
- Before each new round, compare current fixes against `ticket.md` scope and
  this program.
- Do not expand into unrelated harness, telemetry, or UI tickets.
- Stop and record follow-up when a finding requires a broader redesign than this
  stabilization pass.

## Round Protocol
1. `council(round)` -> 3-5 read-only runtime-debugging lanes with distinct
   perspectives.
2. `synthesize(outputs)` -> ranked findings with evidence, likely root cause,
   smallest fix, and verification.
3. `patch(batch)` -> apply only high-confidence, in-scope fixes.
4. `verify(batch)` -> focused tests and typecheck.
5. `log(progress)` -> append compact result to `progress.md`.
6. `stop_or_continue` -> continue while round < 3 and actionable bugs remain.

## Initial Round-0 Findings To Fix
- Volatile `configSnapshot.stateVersion` can defeat structural poll skipping.
- Live-status changes can rebuild layout-facing `employees`.
- Re-entering loading can unmount `<OfficeScene>` after first successful data.
- Generated walls can override preserved furniture because furniture is known
  after walls are generated.
- Repair-time and render-time Project District placement use different inputs.
- One-tile lanes can conflict with divider occupancy math.
