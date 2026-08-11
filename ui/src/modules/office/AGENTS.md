# Office Module

## Boundaries

- Keep office-object runtime metadata normalized through `office-object-ui.ts`.
- Keep scene movement logic in employee locomotion hooks, not object panels or status hooks.
- Resolve semantic skill activity to scene targets in pure helpers before passing data into React Three Fiber.

## Invariants

- Operating rooms are fixed catalog entrypoints. Their hosts are stable
  deskless identities, not continuously running agents or per-project clones.
- The automatic `team_neighborhoods` view uses the pure
  `department-island-layout.ts` geometry for its islands, bridges, room slots,
  and project decks. It remains one tile-backed navigation model and must not
  reflow manual/Builder layouts or create persisted islands, rooms, or agents.
- Room-host text chat must use the validated host/room/scope conversation key;
  project-scoped rooms must never guess a project when none is selected.
- The seven-day stale-project rule filters only Office3D geometry and presence;
  it must not delete or filter the canonical company model used by other views.
- Room activity is a transient projection: in-progress tickets with a known
  specialist create temporary worker visuals; curated telemetry may only enrich
  those workers or show ambient room activity. It must not create tasks,
  persistent agents, or persisted office objects.
- Agent activity targets are keyed by `skillId`, never by persisted office-object IDs.
- Office objects own placement and local runtime UI metadata; status events only report semantic activity.
- Office placement/collision behavior belongs in `systems/occupancy-system.ts` and
  `systems/placement-engine.ts`. Providers, scene components, and HUD panels
  should call those systems instead of defining local footprint or collision
  checks.
- Active project team clusters are derived from project/team state, not deletable furniture; builder delete affordances must steer operators toward archive/remove-team flows instead of pretending a cluster delete will remove the underlying team. `MEM-0182`
- Agent memory inspection must stay memory-first: the employee context panel should lead with parsed `MEMORY.md` and `memory/*.md` entries, while broader workspace files or board workflows remain secondary handoffs instead of the default view. `MEM-0191`
- Builder object movement must constrain against the live `officeLayout` tile mask, not the nav-grid snap alone, so newly added floor area becomes immediately usable for placement and drag preview matches persisted placement rules. `MEM-0187`
- Builder object selection should keep the scene radial menu lean (`Move`, `Transform`, `Settings`) and route rotate/scale/delete through the shared transform panel so builder controls do not duplicate across overlays. `MEM-0190`
- Avatar targeting must remain transient and presentation-only; it must not rewrite persisted desk or object transforms.
- Shared skill hosts must fan active avatars across deterministic local slots so multiple agents can occupy one object without overlapping.
- Skill effects must be chosen once per activity from object metadata and remain stable for that activity; render code may not randomize effects per frame or per rerender.

## Tests

- Prefer pure tests for skill-target resolution and metadata parsing.
- Validate locomotion changes with focused unit tests before relying on manual scene checks.

## Conventions

- Major logic files need the standard header block.
- New office-object runtime metadata must remain backward-compatible with existing persisted `metadata`.
