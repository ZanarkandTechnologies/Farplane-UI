---
kind: feature-spec
status: active
project: Farplane UI
created_at: 2026-08-05
updated_at: 2026-08-05
owner: office
related_systems:
  - ../systems/README.md
source_refs:
  - ../../ui/src/modules/office/lib/operating-room-catalog.ts
  - ../../ui/src/modules/office/lib/room-hosts.ts
  - ../../ui/src/modules/office/lib/room-activity-projection.ts
  - ../../ui/src/providers/office-project-visibility.ts
  - ../../ui/src/modules/world-map/hooks/use-company-world-projection.ts
  - ../../ui/src/modules/self-improvement/
external_grounding:
  - official TanStack Query useQueries documentation
  - official Convex React useQuery documentation
  - official React Three Fiber events documentation
---

# Hosted Operating Rooms

The spatial office is an entrepreneur simulator organized around eleven stable
operating rooms. Each room combines one fixed host identity, one existing
operational UI, and a restrained projection of current work. Projects remain
the durable business boundary; rooms are shared functional entrypoints rather
than new task owners or continuously running agents.

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

## Activity Contract

- Existing skill-invocation telemetry is read once at scene level and projected
  only through each room's curated `activitySkillIds`.
- One active session/project pair produces one worktable marker in its owning
  room. The room shows at most three markers plus an overflow count.
- Markers are re-evaluated every ten seconds and expire after the existing
  five-minute telemetry freshness window. They are presentation-only: they do
  not spawn agents, create tasks, move persistent furniture, or expose absolute
  paths.
- Advisor and entrypoint skills are separate from activity skills; non-artifact
  ingest and generic execution calls do not automatically produce worktables.

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

- Rooms do not clone hosts per project and do not visualize every subagent or
  skill call.
- Cross-project project-room chat requires an explicit selected project.
- The aggregate World caps configured project reads at 24, nodes at 400, edges
  at 800, and its office preview projection at 80 nodes and 120 edges.
