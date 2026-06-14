---
title: Generated Native Goal Prompt
ticket: tickets/building/TKT-013-telemetry-dashboard/ticket.md
created_at: 2026-06-14
---

# Generated Native Goal Prompt

```text
/goal Run the following files as one Goal Packet.
Files:
- tickets/building/TKT-013-telemetry-dashboard/ticket.md
- tickets/building/TKT-013-telemetry-dashboard/program.md
- tickets/building/TKT-013-telemetry-dashboard/progress.md
- tickets/building/TKT-013-telemetry-dashboard/plan.md
- tickets/building/TKT-013-telemetry-dashboard/artifacts/research/aikage-telemetry-gap.md
- tickets/building/TKT-013-telemetry-dashboard/artifacts/evidence/current-telemetry-no-charts.png
- tickets/todo/TKT-013-telemetry-bento-dashboard.md
- ui/package.json
- package-lock.json
- ui/src/components/ui/chart.tsx
- ui/src/modules/telemetry/AGENTS.md
- ui/src/modules/telemetry/telemetry-dashboard-content.tsx
- ui/src/modules/telemetry/telemetry-dashboard-types.ts
- ui/src/modules/telemetry/components/telemetry-dashboard-views.tsx
- ui/src/modules/team-workspace/components/telemetry-tab.tsx
- convex/modules/runtimeTelemetry/AGENTS.md
- convex/modules/runtimeTelemetry/runtimeTelemetry.ts
- convex/modules/runtimeTelemetry/telemetry.ts
- convex/modules/runtimeTelemetry/validators.ts
- convex/modules/runtimeTelemetry/runtimeTelemetry.test.ts
- PROJECT_RULES.md
- docs/TASTE.md
- qa/README.md

Task: Complete the Recharts/Aikage-parity revision of TKT-013. Add Recharts to
the UI workspace, port a shadcn-style chart wrapper, extend the runtime
telemetry summary with Aikage/Console parity fields, replace custom telemetry
SVG/HTML charts with Recharts-backed dashboard views, preserve Raw Telemetry,
and capture browser proof for global/team dashboard/raw states. Preserve
duration-cap semantics, same-session next-start recovery, public-mode raw-tab
hiding, and the privacy boundary that forbids raw assistant output/transcripts.

Logging: Before ending each turn, append a compact structured entry to
tickets/building/TKT-013-telemetry-dashboard/progress.md with trigger, actions,
changed files/artifacts, metric or feedback sample, drift verdict, next_action,
and blockers. Update ticket.md checkboxes and QA artifacts only when proof
exists.

Metric: Use the hybrid metric in program.md and concrete proof in plan.md:
focused runtime telemetry tests, focused lint, root typecheck, telemetry-filtered
UI typecheck, UI build where possible, git diff whitespace check, browser
screenshots for global/team dashboard/raw views, and review judgment that
Aikage parity, duration confidence, dense dashboard UX, and privacy boundaries
are correct.

After each turn: Compare progress against ticket.md, program.md, plan.md, and
the Aikage gap report. Continue within the active implementation window if
useful. Stop complete only when the revision Done / Proof checklist is
satisfied, evidence is linked, and residual workspace failures are documented.
Stop blocked only after three consecutive attempts cannot run necessary
UI/query proof and no useful mocked/no-Convex proof path remains.

Budget: one focused active implementation window; subagents allowed for
independent UI QA, chart/reference inspection, or review; browser QA required;
spend none.
```
