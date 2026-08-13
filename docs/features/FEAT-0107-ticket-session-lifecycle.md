# SC07: Ticket-Session Lifecycle Contract

## Scope

Define ticket lifecycle semantics in Farplane UI where one active ticket maps to one active agent session until explicit closure.

## Canonical References

- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins
- `SC04`: `docs/features/FEAT-0104-chat-bridge-openclaw.md`
- `SC06`: `docs/features/FEAT-0106-kanban-federation-sync.md`

## Product Rule

For SC07:

- `ticket == session` while ticket state is active (`todo`, `in_progress`, `blocked`).
- The ticket/task card is also the compact operator-visible memory surface for the active session.
- Ticket close transitions associated session to closed/archived state.
- Reopen creates a new active session link unless policy explicitly allows resume.

## Lifecycle States

### Ticket States

- `todo`
- `in_progress`
- `blocked`
- `done`
- `cancelled`

### Session Link States

- `unbound`
- `active`
- `closing`
- `closed`
- `reopened`

## Data Contracts

### Ticket Routing

- `owner` remains the accountable person/agent.
- `specialist` is an optional artifact-work identity such as
  `landing-page-specialist`; it maps through the Office specialist registry to
  one facility. It is not a persistent employee and is never inferred from a
  title, prompt, skill, or subagent type.
- `thread_id` binds the ticket to its one primary inspectable Codex task
  thread. The root lifecycle hook writes it only for an active unbound ticket
  named exactly once; ticket commands and UI edits never set or replace it.
  A missing binding does not make a ticket invalid, but prevents direct task
  thread inspection from its office worker.

### TicketTaskThread

- `projectId`
- `ticketId`
- `threadId` (the `thread_id` scalar in `ticket.md`)
- `state` derives from the ticket lifecycle; it is not stored separately
- `createdAt` and closure history remain in ticket metadata and Markdown

There is no separate ticket-session binding record or policy. The task thread
is the ticket's user-facing comments and execution context; helper/subagent
threads are internal and never become ticket bindings.

## Required Flows

### Create Ticket

- Create an unbound ticket with its specialist and accountable owner.
- The first root task prompt that names it exactly once lets the lifecycle hook
  atomically write `thread_id`.
- Show task-thread context in ticket detail once it is bound.

### Update Ticket

- Status, ownership, and specialist changes keep the existing task thread.
- Assignment cannot rebind a ticket to another task thread.
- Task notes remain compact resume state alongside the richer reasoning in the
  same task thread.

### Close Ticket

- Complete and mine the ticket through its own `thread_id`.
- Keep the task thread inspectable as the ticket's durable discussion history.

### Reopen Ticket

- Reopening resumes the same task thread when work remains in scope. A material
  new outcome becomes a new ticket with a new task thread.

## UI Requirements

- Ticket detail shows the ticket's task thread and can open that task directly.
- Kanban may show a declared specialist and its derived facility alongside the
  accountable owner; it does not offer a second task store or inferred routing.
- The task panel can filter by open tickets without creating a second binding
  store or closure trail.
- Close/reopen state remains the ticket lifecycle, with deterministic errors.

## Observability and Audit

- The hook binding records only the immutable task thread ID on the ticket.
- Failed hook binds remain visible as telemetry diagnostics and never overwrite
  an existing task thread.
- No silent divergence exists because ticket lifecycle and task ownership share
  the same source file.

## Acceptance Criteria

- New tickets stay unbound until their first eligible root task prompt.
- Only that root task's immutable `thread_id` can enrich the assigned worker.
- Closing ticket mines its own task thread without closing or replacing it.
- Operators can inspect the task thread from ticket detail and diagnose rejected
  rebind attempts through hook telemetry.
