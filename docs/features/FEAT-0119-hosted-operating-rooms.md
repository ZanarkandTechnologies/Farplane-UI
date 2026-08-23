---
kind: feature-spec
status: active
project: Farplane UI
created_at: 2026-08-05
updated_at: 2026-08-14
owner: office
related_systems:
  - ../systems/README.md
source_refs:
  - ../../ui/src/modules/office/lib/operating-room-catalog.ts
  - ../../ui/src/modules/office/lib/room-hosts.ts
  - ../../ui/src/modules/office/lib/room-activity-projection.ts
  - ../../ui/src/lib/ticket-routing/specialist-registry.ts
  - ../../ui/src/modules/office/components/facility-console.tsx
  - ../../ui/src/modules/evals/components/qa-ticket-queue.tsx
  - ../../ui/vite.config.ts
  - ../../ui/src/providers/office-project-visibility.ts
  - ../../ui/src/modules/world-map/hooks/use-company-world-projection.ts
  - ../../ui/src/modules/self-improvement/
external_grounding:
  - official TanStack Query useQueries documentation
  - official Convex React useQuery documentation
  - official React Three Fiber events documentation
---

# Hosted Operating Rooms And Facilities

The spatial office is an entrepreneur simulator organized around eleven stable
operating rooms and permanent specialist facilities. Rooms combine a fixed host
identity with an existing operational UI. Facilities are the artifact-producing
services an operator can enter to start project work. Projects remain the
durable business boundary; neither rooms nor facilities become task owners or
continuously running agents.

## Room Contract

`room(host, panel, scope, activitySkills) -> spatial entrypoint + scoped chat + live workbench`

- The fixed catalog is Self-Improvement Lab, Research Library, Production
  Studio, QA Lab, Harness Workshop, Skill Lab, Organization Hall, Finance
  Office, Comms Hub, Telemetry Console, and Thread Data Lab.
- Every placed room projects exactly one deskless, persistent host from the
  tracked specialist profile catalog. Hosts do not consume team desks and do
  not imply continuously running workers.
- A host conversation is keyed by `hostAgentId + roomId + scope`. Office rooms
  reuse one office-scoped task; project rooms require the selected project and
  isolate simultaneous project conversations.
- Room panels keep their existing data ownership. The room is a spatial
  entrypoint, not a replacement backend or duplicate mini-app.

## Facility Contract

`facility(project, specialist, request) -> ticket + one bound task thread + visible dispatch`

- Every registry-backed artifact specialist has one permanent station in its
  capability department. A full operating room can host several stations;
  Sales and Deals use direct service bays rather than duplicate rooms.
- Selecting a station asks for a configured project and the requested outcome.
  The client submits only that project ID; the bridge resolves it against the
  server-owned company model before work begins. Starting work writes one
  canonical filesystem ticket with the selected `specialist`, creates one
  Codex task thread, and binds its write-once `thread_id` in the ticket
  frontmatter before the first turn begins.
- The facility is reusable across projects. It does not clone a permanent
  employee, retain project-local job state, or own a second task board.
- The specialist's preferred skill is task-thread guidance only. Raw skill,
  helper, advisor, and telemetry events never create facilities, tickets, or
  task threads.

## Activity Contract

- An `in_progress` filesystem ticket with a known `specialist` produces one
  temporary project-worker clone at the specialist's mapped station. Its
  identity is ticket, project, and facility, so concurrent projects can use
  the same specialist without collision. The Office does not cap the number of
  eligible dispatches; the station remains a compact aggregate visual.
- Existing skill-invocation telemetry is read once at scene level. A fresh event
  whose raw thread id matches that ticket's `thread_id` enriches the worker's
  displayed action; telemetry without a matching ticket is ambient facility
  activity, never a worktable or worker.
- Workers disappear when the ticket leaves `in_progress`; five-minute telemetry
  freshness only governs ambient/action effects. The projection is
  presentation-only: it does not spawn agents, create tasks, move persistent
  furniture, or expose absolute paths.
- Advisor and entrypoint skills remain separate from artifact specialists;
  non-artifact ingest, generic execution, and phase helpers do not create
  workers.

## Work-Surface Taxonomy

The Office makes the work contract legible without treating every skill as an
employee or a ticket factory.

```text
artifact specialist -> permanent studio -> new ticket + one bound task chat
phase skill         -> existing room host -> acts on an existing ticket
integration         -> channel desk/account -> acts on configured channel state
advisor             -> room-host expertise -> scoped conversation, no new worker
```

- Artifact specialists are the only entries in the specialist registry. Their
  console explains the deliverable, lists this project's existing jobs, opens
  each ticket's bound task chat, and can brief one new job.
- Phase skills such as planning, review, testing, and QA are not facilities.
  QA lives in QA Lab with Proof, where it evaluates a ticket's existing claim
  and writes ticket-scoped evidence. The QA Lab panel shows review and
  QA-required tickets for the selected project, opens each ticket's bound task
  chat, and links to Proof's host conversation; it never starts a generic “QA
  outcome.”
- Integrations such as publishing or account operations remain bound to their
  channel/account UI. They do not receive a fictional specialist employee.
- Room hosts (including Ledger, Scout, Rig, and Proof) are persistent chat
  entrypoints and data/UI stewards, not artifact workers.

## Project Visibility Contract

- Project retention remains unchanged. The seven-day rule filters only the
  Office3D projection.
- Archived projects and idle projects whose latest known activity is older
  than seven days are hidden from team clusters, employees, desks, areas, and
  project pulses.
- Running work, an active Goal, a recent heartbeat, or activity exactly on the
  seven-day boundary keeps a project visible. Missing timestamps fail open.
- Hidden projects stay available to company state, panels, history, and the
  aggregate Company World.

## Company World And Self-Improvement

- The Command Commons opens Company World, whose default view aggregates
  configured project graphs with project-qualified identities and bounded
  query/node/edge caps. One failed project remains an isolated warning.
- The center remains a restrained portal cue; it does not eagerly load every
  project graph into the WebGL scene.
- Self-Improvement Runs reads bounded, contained filesystem Goal Packets from
  configured projects. A run is included only when its program explicitly
  declares a `skill_improvement` loop. Missing scores or evidence remain
  absent rather than being inferred.

## Limits

- Rooms and facilities do not clone hosts per project and do not visualize
  every subagent or skill call.
- Cross-project project-room chat requires an explicit selected project.
- The aggregate World caps configured project reads at 24, nodes at 400, edges
  at 800, and its office preview projection at 80 nodes and 120 edges.
