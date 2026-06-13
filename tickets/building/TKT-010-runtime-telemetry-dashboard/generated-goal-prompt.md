# Generated Native Goal Prompt

```text
/goal Run tickets/building/TKT-010-runtime-telemetry-dashboard/ticket.md as a Goal Packet.

Task: Implement the approved runtime telemetry dashboard plan. Add Aikage-compatible activity lifecycle ingest/storage, derive completed agent hours from matched turn_start -> turn_end rows only, expose shared global/team telemetry queries, add a global Telemetry launcher/module surface, and add a Team Panel Telemetry tab using Farplane UI shadcn-style primitives and theme tokens. Preserve existing board timeline, agent status, team overview, and runtime cost behavior. Do not import old Aikage/Farplane-Console UI components wholesale. Do not count unmatched or open lifecycle events as completed time. Do not send raw assistant output or transcripts.

Logging: Before ending each turn, append a compact entry to tickets/building/TKT-010-runtime-telemetry-dashboard/progress.md with trigger, intent, actions, files/artifacts, metric or feedback sample, drift verdict, next_action, and blockers.

Metric: Satisfy the hybrid metric in tickets/building/TKT-010-runtime-telemetry-dashboard/program.md: focused reducer/query tests, typecheck/lint or documented pre-existing failures, git diff whitespace check, and browser evidence for the global Telemetry dashboard and Team Panel Telemetry tab.

After each turn: compare progress against ticket.md Scope, Done / Proof, and Hard gates; continue from the largest unresolved acceptance/evidence gap; request reviewer lane if ingest/auth expands beyond local-hook/private deployment parity; stop complete only when proof is captured or report blocked with attempted paths and the missing input.
```
