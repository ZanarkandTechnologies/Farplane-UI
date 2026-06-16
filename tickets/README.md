# Farplane Tickets

Tracked Farplane tickets live under `tickets/TASK-*/ticket.md`.

This folder is the project-local execution queue for work that has become
concrete enough to plan, build, verify, review, and close. It is not the place
for generated proof blobs or old lane-board artifacts.

## Tracked Shape

```text
tickets/
  README.md
  TASK-0001/ticket.md
  TASK-0002/ticket.md
  archive/
    TASK-0000/.gitkeep
  templates/
    ticket.md
```

## Local-Only Legacy State

The old lane folders are intentionally ignored:

- `tickets/todo/`
- `tickets/building/`
- `tickets/review/`
- `tickets/done/`
- `tickets/INDEX.md`

Use them only as local reference while migrating. Do not add new work there.

## Rules

- One ticket should describe one executable work loop by default.
- Keep `ticket.md` as the task-local source of truth.
- Keep screenshots, logs, traces, and generated proof under ignored artifact
  folders unless a ticket explicitly promotes a small proof file.
- Move completed tracked tickets into `tickets/archive/TASK-*/ticket.md`.
- Use `tickets/templates/ticket.md` for new implementation tickets.
- Use `tickets/TASK-0001/ticket.md` as the post-init PRD handoff until it is
  completed or archived.

## References

- Root contract: `AGENTS.md`
- Project rules: `PROJECT_RULES.md`
- Bootstrap brief: `docs/bootstrap-brief.md`
- Farplane manifest: `farplane/manifest.json`
- QA guide: `qa/README.md`
