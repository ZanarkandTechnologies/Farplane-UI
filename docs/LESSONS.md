# LESSONS

Distilled lessons from repeated trouble, review passes, QA passes, and
implementation corrections.

Use `docs/TROUBLES.md` for raw pain and failed attempts first. Promote only
durable lessons here, then promote true invariants into `docs/MEMORY.md` or the
relevant project/skill contract.

## Template

```text
YYYY-MM-DD | area | lesson

Context:
- What repeated issue or correction caused this?

Lesson:
- What should future agents do differently?

Promote:
- Keep here / move to MEMORY / move to PROJECT_RULES / move to skill
```

2026-06-30 | telemetry/event-miner | Hookless agents must be artifact-only at both runtime and prompt layers

Context:
- A hookless event-miner child was launched with hooks disabled, but its prompt still suggested direct telemetry publishing, causing user confusion about ownership boundaries.

Lesson:
- When a child agent is meant to be hookless, remove direct publish/API/secret instructions from its prompt and make the parent hook/server side the only telemetry publisher.

Promote:
- Keep here / move to event-miner hook contract if repeated.

2026-06-30 | mining/ui | Cross-project mine artifact links need explicit project scope

Context:
- A timeline Open Mine Run action for TASK-0250 opened a stale artifact from the UI repo because the target carried only run/output ids and the bridge fell back to the default project mine root.

Lesson:
- When UI controls open local mining artifacts for another project, carry projectPath with runId/outputId through every state boundary and reset derived targets when the active project changes.

Promote:
- Keep here / move to Thread Data or mining bridge contract if repeated.
