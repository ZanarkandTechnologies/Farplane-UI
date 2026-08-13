# SC12: Filesystem Ticket Planning And Review

## Status

Active SC12 replacement spec. This is the target workflow contract for Farplane task planning, human review, and agent execution.

## Purpose

Define the minimal workflow Farplane should support for agent-led planning:

- filesystem `ticket.md` files as the canonical task and review state
- markdown task memory as the working state
- `review` as a normal ticket status
- human review through the same task, not a separate proposal object
- per-agent views as filters over filesystem tickets, not separate persisted stores

## Workflow Contract

1. Agent reads the filesystem ticket queue.
2. If there are no actionable tickets, agent creates one or more planning tasks.
3. Agent writes the plan into the task memory.
4. Agent moves the task into `review` when human sign-off is needed.
5. Human reviews by operating tickets in `review`.
6. After review, work continues on the same task.
7. Agent claims the task, gathers more context, and appends progress into the same task memory.
8. The task moves through normal ticket statuses until complete.

## State Model

Structured ticket frontmatter stays thin:

- `ticket_id`
- `projectId`
- `teamId`
- `title`
- `status`
- `priority`
- `ownerAgentId`
- `threadId` when the canonical ticket has been hook-bound to its task thread
- timestamps
- optional generic review metadata like `approvalState`

Rich task state lives in the ticket Markdown body:

- goal
- plan
- gathered context
- blockers
- review notes
- progress log
- execution outcome

## Per-Agent Views

Each project has one canonical filesystem ticket set. An agent view is a filtered view over those tickets, usually by:

- `ownerAgentId`
- `status`
- unassigned tasks
- review tasks

Do not create a second persisted store per agent.

## Required CLI Surface

- `team ticket create`
- `team ticket update`
- `team ticket status`
- `team ticket claim`
- `team ticket list`
- `team ticket memory show`
- `team ticket memory set`
- `team ticket memory append`

## Product Rules

- No separate proposal persistence model.
- No special workflow object for planning approval.
- Human review is lane-driven.
- Task memory is markdown-first.
- Append-only logs remain the durable audit surface outside mutable task memory.

## Acceptance Criteria

1. An agent can create a planning task when no actionable work exists.
2. The agent can append a plan to task memory and move the task into `review`.
3. Human review can happen entirely through the ticket and task memory.
4. An agent can claim a reviewed task and continue from the same task memory.
5. Per-agent task views are filtered ticket views, not separate stores.
