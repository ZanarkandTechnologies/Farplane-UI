# Office Module

> **Feature Status**: Active
> **Last Updated**: Aug 2026

## Overview

The Office System provides the 3D office environment where employees, teams, and furniture are rendered and interactable. It includes employee visualization, object interaction, and agent management UI.

## Core Components

### Hosted Operating Rooms ✅

**Status**: Active (Aug 2026)

The office has eleven fixed functional rooms, each with one deskless host and
one registered operational panel. It also has permanent registry-mapped
specialist furniture: selecting a workstation chooses a project and outcome, creates its
canonical ticket, binds the ticket's one Codex task thread, and opens that
conversation. A ticket's `specialist` maps to one workstation while its `owner`
remains accountable. Curated skill telemetry never creates work or a resident
worker; it can only render a short-lived observed-flow overlay. Hosts are stable
chat entrypoints, not permanently running workers: office hosts reuse an office-scoped conversation,
while Research, Production, and QA require the selected project and keep
concurrent projects isolated.

Artifact-producing work receives a permanent workstation. Its console shows a
selected project's existing jobs and their bound task chats before it offers a
new brief. Integrations receive a permanent system facility instead: it shows
the operated system and delivery boundary but never creates a ticket, task, or
chat. The first pilot is `X Thread Writer` in Production Studio, which starts
one ticket and bound Codex task thread to produce `x-thread-draft`, alongside
the non-chat `X Publishing` facility operated by `x-account`. Planning, review,
testing, and QA remain phase skills inside their existing rooms; advisors are
room-host expertise.

The seven-day inactivity rule affects only the Office3D projection. Hidden
project clusters, employees, desks, pulses, and areas remain intact in the
company model and other panels. Command Commons opens the bounded aggregate
Company World. Self-Improvement Lab reads real ticket Goal Packets instead of
the retired training modal.

**Key files**:

- `lib/operating-room-catalog.ts`: room inventory, hosts, scopes, panels, and curated skills
- `lib/room-hosts.ts`: stable host projection and conversation keys
- `lib/project-council-layout.ts`: deterministic Council sectors and studio station layout
- `lib/project-council-presence.ts`: CEO / Project Pulse Council Lead selection
- `components/project-council.tsx`: central Council and project click targets
- `components/specialist-studio-stations.tsx`: fixed artifact workstations that start ticket/thread work
- `components/system-facilities.tsx`: fixed integration-system facility visualization
- `components/facility-console.tsx`: project/outcome entrypoint that starts workstation work
- `components/system-facility-console.tsx`: non-chat integration boundary panel
- `lib/system-facility-registry.ts`: explicit integration facility projection
- `lib/observed-skill-flow-projection.ts`: session-local, telemetry-backed flow selection
- `scene/observed-skill-flow-effects.tsx`: transient Nexus-style arcs between observed endpoints
- `../../providers/office-project-visibility.ts`: Office3D-only stale-project policy
- `../world-map/hooks/use-company-world-projection.ts`: aggregate company graph
- `../self-improvement/`: ticket-backed self-improvement run surface

### Room Rendering And Placement ✅

**Status**: Active (Aug 2026)

Native low-poly `activity-landmark` objects now render the fixed eleven-room
operating catalog: Self-Improvement Lab, Research Library, Production Studio,
QA Lab, Harness Workshop, Skill Lab, Organization Hall, Finance Office, Comms
Hub, Telemetry Console, and Thread Data Lab. Each room opens one registered
top-level panel and projects one fixed, deskless host. Company World opens from
the central Command Commons; Builder, Settings, decoration, secondary/raw
views, and leaf tabs stay launcher-only.

Landmark panel routing and avatar activity targeting are independent metadata
bindings. `uiBinding` opens one registered top-level panel, while `skillBinding`
can bind one primary `skillId` plus aliases to the same transient avatar anchor.
The operator's live sidecar owns destination identity and mapping.

The automatic `team_neighborhoods` presentation is a light department
archipelago, not an enclosed building. Seven raised, rounded capability islands
(Back Office, Sales, Deals, Marketing, Operations, Intelligence, and Customer)
join a central Project Council around the Company Nexus through ordinary
walkable bridges. Every Office-visible project receives one equal Council
sector. Its existing project CEO is the Council Lead; Project Pulse fills an
empty project seat. The company CEO stays outside the Council. The same tile
layout remains the only navigation/click system; slabs are presentation
geometry, not persisted collision state.

Every room remains a 5 x 5 tile-aligned station with its existing host and panel.
The automatic presentation removes bay walls, the
rectangular checkerboard shell, the Command Commons cage, and persistent room
identity pills; room identity appears through ordinary hover and interaction.
Warm light platform tops, darker neutral edges, contact shadows, a compact
Council ring, and one table-free Company World nexus
with a large, multi-path particle hive-mind swarm provide the hierarchy. `manual`, Builder,
equipped-kit, and all other layout strategies continue to render their saved
floors, walls, and transforms without archipelago reflow.

The room envelope participates in placement collision so rooms cannot overlap
tables or one another, but activity landmarks do not register as runtime
navigation obstacles. Employees walk through the open side to interior,
occupant-spread activity spots instead of stopping outside the room.

Each room remains one persisted object. Its renderer owns the floor zone,
permanent equipment, and stable room/host plaque. In the archipelago, a room
landmark is suppressed only after admitted capability furniture represents that
same room; other rooms remain visible until their own conversion. Specialist stations are
fixed registry-mapped service facilities, not employees: clicking one starts
an operator-selected project's canonical specialist ticket and its one bound
task thread. During a real hook event, the Office can draw a brief curved,
dashed Nexus-style link from the matching session owner to called furniture and
from the session's immediately preceding known furniture to the current one.
The effect needs existing `sessionId + skillId + occurredAt`; it never predicts
a next step, adds a `delivery_targets` field, creates a worker, ticket, or
persistent process edge. The static Capability Map remains telemetry-free.

**Key files**:

- `components/activity-landmark.tsx`: persisted metadata, interaction, and camera-facing adapter
- `components/activity-landmark-visuals.tsx`: authored landmark-kind procedural props
- `components/activity-destination-room-visual.tsx`: room station presentation and contextual label treatment
- `components/activity-landmark-destinations.tsx`: curated destination-specific procedural props
- `prefabs/activity-landmark-prefab.tsx`: builder placement registration
- `panels/internal-panel-catalog.ts`: canonical internal-panel identifiers
- `panels/use-internal-panel-launcher.ts`: shared landmark/launcher panel routing
- `skill-targeting.ts`: primary and alias skill lookup
- `activity-scenes.ts`: landmark-to-scene catalog and renderer fallback
- `../../../config/theme-system.ts`: shared appearance names, persistence key, and Company Nexus primitives
- `../../../config/office-theme.ts`: scene-wide day/night role mapping resolved from the shared appearance mode
- `components/employee/activity-scene-props.tsx`: engaged-only shared props
- `lib/department-island-layout.ts`: canonical department, bridge, room-slot, and project-deck geometry
- `lib/observed-skill-flow-projection.ts`: pure observed-call and predecessor projection
- `scene/observed-skill-flow-effects.tsx`: bounded animated Office overlay
- `lib/office-layout-solver.ts`: automatic layout selection and ordinary tile-backed reachability
- `object-ui/metadata.ts`: backward-compatible multi-skill normalization

### Office World Store And Reconciliation ✅

**Status**: Active (Jun 2026)

The office scene now has a module-local state boundary for adapter-derived world
state. Runtime snapshots from Codex/OpenClaw are reconciled into the Zustand
office world store before render-facing consumers read them, so background
polling can report precise changed keys instead of rebroadcasting a full fresh
office tree.

**Ownership**:

- **`store/office-world-store.ts`**: canonical adapter-derived office world
  state for teams, employees, desks, office objects, office areas, settings,
  workload, warnings, live status, loading/error metadata, and debug counters
- **`store/office-world-reconciliation.ts`**: pure snapshot reconciliation,
  semantic reference preservation, normalized lookup maps, and changed-key
  reporting
- **`store/office-world-selectors.ts`**: narrow selector surfaces for scene,
  bootstrap, and compatibility context consumers
- **`ui/src/store/app-store.ts`**: transient UI intent only, including selected
  objects, open panels, builder mode, overlays, modals, and onboarding state
- **`ui/src/providers/office-data-provider.tsx`**: adapter polling and
  compatibility context; it commits snapshots into the office world store

**Rule**: adapter-derived world state belongs in the office world store;
interaction intent belongs in `useAppStore`; runtime-specific fetching stays
behind runtime adapters and providers.

---

### Office Occupancy And Placement Engine ✅

**Status**: Active (Jun 2026)

Office placement now has a system-owned contract instead of scattered
component/provider heuristics.

**Key files**:

- **`systems/occupancy-system.ts`**: object footprints, claimed cells, layout containment, collision reports, pathfinding-ready walkability derivation
- **`systems/placement-engine.ts`**: placement reservations, candidate ordering, legal-slot selection
- **`utils/object-footprints.ts`**: compatibility re-export only; new code should import from `systems/occupancy-system`

**Consumers**:

- Generated project/team table placement in the office data mapper
- Builder drag and exact transform validation
- Debug grid occupancy overlays
- CLI placement/shuffle parity checks
- Future A\* pathfinding integration through `buildOfficeWalkabilityGrid`

---

### Object UI Bindings And Builder Panels ✅

**Status**: Complete (Mar 2026)

Office objects can now carry metadata-driven runtime UI bindings while keeping builder-only transform/config controls separate from normal scene interactions.

**Behavior**:

- **Builder mode**:
  - Furniture/custom objects expose `Move`, `Transform`, and `Settings` in the in-scene radial controls
  - The draggable Transform panel opens from the `Transform` radial action and owns rotate, resize, and delete
  - Settings open the Object Builder panel for embed configuration
- **Normal mode**:
  - Builder controls are hidden for office objects
  - Configured objects open a routed runtime panel instead of the radial menu
- **Embeds first**:
  - Runtime panel supports iframe-backed embeds with an external-open fallback for blocked sites
  - Objects can optionally bind a `skillId`; live agent activity resolves that semantic skill to the hosting object for in-scene targeting without coupling status to object IDs

**Key Files**:

- **`office-object-ui.ts`**: typed metadata helpers for `uiBinding` and `skillBinding`
- **`components/object-config-panel.tsx`**: builder-side embed and skill-binding configuration panel
- **`components/object-interaction-panel.tsx`**: runtime object panel/iframe viewer
- **`components/interactive-object.tsx`**: builder gating, runtime click routing, persisted scaling
- **`skill-targeting.ts`**: pure `skillId -> object anchor` resolution for avatar activity targeting

---

### Interactive Object System ✅

**Status**: Complete (Nov 22, 2025)

Unified system for furniture and interactive objects in the 3D office.

**Architecture**:

- **`DraggableController`** (`controllers/draggable-controller.ts`): Pure TypeScript class for drag logic
  - Handles raycasting, grid snapping, event management
  - Testable without React
- **`InteractiveObject`** (`components/interactive-object.tsx`): Unified component for furniture/objects
  - Selection, hover, drag, context menu, DB sync
  - Uses DraggableController for drag operations
- **Employee Pattern**: Employees use `ContextMenu` directly (local selection state, no wrapper needed)

**Results**: 822 lines across 4 files → ~390 lines across 2 files (53% reduction)

**Deleted Files**:

- ❌ `draggable-object.tsx` (357 lines)
- ❌ `selectable-wrapper.tsx` (145 lines)
- ❌ `use-drag-drop.ts` (320 lines)
- ❌ `selection-store.ts` (23 lines)

### Employee Hover Labels & Team Directory ✅

**Status**: Complete

Added hover labels to employees (similar to teams) and created a Team Directory page accessible from the global speed-dial menu.

**Features**:

- **Employee Hover Labels**: Employees show labels on hover displaying name, job title, and team name
- **Highlighted Employees**: Enhanced styling with ring effect and blue arrow indicator
- **Team Directory Component** (`components/hud/team-directory.tsx`):
  - Search functionality: filter by name, job title, or team
  - Grouped by team for better organization
  - Employee cards show: name, job title, team, CEO badge
  - "Locate" button highlights employee in 3D scene
- **Employee Highlighting System**:
  - Added `highlightedEmployeeId` to app store
  - Highlighted employees show enhanced label with primary color ring
  - Auto-clears after 5 seconds
- **Speed-Dial Integration**: Added "Team Directory" option to global speed-dial menu

**Technical Details**:

- Uses `Html` component from `@react-three/drei` for 3D text overlay
- Employee component receives `jobTitle` and `team` props
- Label positioned above employee using `TOTAL_HEIGHT + 0.5`

**Future Enhancements**:

- [ ] Add camera focus animation when locating employee
- [ ] Add employee status indicators in directory
- [ ] Add filters (by team, by status, etc.)
- [ ] Add employee detail view on click

---

### Agent Management UI ✅

**Status**: Complete (Nov 22, 2025)

Dashboard-style agent management UI for configuring employee agents.

**Component**: `components/manage-agent-dialog.tsx`

**Features**:

- **Overview Tab**: Employee stats and info
- **Tools Tab**: Multi-select tool configuration
- **Skills Tab**: Multi-select skill configuration
- **Prompt Tab**: System prompt editor

**Integration**:

- "Manage" button in employee context menu opens dialog
- Dialog state managed in `app-store.ts`
- Wired through `office/page.tsx`
- Employees link to agent configs via `agentConfigId` field

**Backend Integration**:

- Uses OpenClaw gateway + `openclaw-adapter` for CRUD operations
- Links to `toolConfigs` and `skillConfigs` for configuration
- Auto-creates default config if missing when chatting

### Codex Employee Activity And Handoffs ✅

**Status**: Active (Jul 2026)

Codex mode uses capability-driven employee controls instead of inheriting
OpenClaw configuration affordances. App-server-backed tasks keep Chat,
Inspect, and local Move controls. Hook-observed tasks expose Activity and Move;
Activity opens a read-only inspector backed by Convex hook telemetry rather
than an empty writable chat.

The inspector makes the selected task's connected handoff network the primary
surface: operators can search and filter tasks, inspect root/current/ephemeral
nodes, and replay a selected handoff in the office. Parented and ephemeral
workers remain outside the durable office roster. The scene lineage renderer
draws one short light-blue link for every handoff type and projects a temporary
endpoint when the child has no avatar.

**Key files**:

- `components/employee/use-employee-actions.tsx`: runtime-capability radial actions
- `components/manage-agent-modal/codex-thread-inspector.tsx`: hook-only connected handoff graph
- `scene/thread-lineage-effects.tsx`: fresh-event and explicit-replay scene links
- `providers/office-data-refresh.ts`: durable-root versus ephemeral-worker roster boundary

---

## File Structure

```text
modules/office/
├── README.md                          # This file
├── index.ts                           # Public API exports
├── definitions.ts                     # Type definitions
├── components/
│   ├── interactive-object.tsx        # Unified furniture/object component
│   ├── employee.tsx                  # Employee 3D component with hover labels
│   ├── manage-agent-dialog.tsx       # Agent management UI
│   └── hud/
│       └── team-directory.tsx        # Team directory component
├── controllers/
│   └── draggable-controller.ts       # Drag logic controller
├── store/                             # Feature-specific stores
├── systems/                           # Systems (lighting, etc.)
└── prefabs/                           # 3D prefabs
```

---

## Integration Points

- **App Store** (`ui/src/store/app-store.ts`): Global state for highlighted employees, dialog state
- **Agent System** (`ui/src/modules/runtime/lib/openclaw/adapter.ts`): Agent configurations, tools, skills
- **Chat System** (`modules/chat/`): Employee DMs use agent configs
- **Team System** (`modules/team-workspace/`): Team directory integration

---

## Related Systems

- **Nav System** (`modules/navigation/`): Pathfinding and navigation for employees
- **Chat System** (`modules/chat/`): Employee-agent communication
- **Agent System** (`ui/src/modules/runtime/lib/openclaw/adapter.ts`): Agent configuration backend
