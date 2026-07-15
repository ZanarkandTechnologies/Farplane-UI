---
template_id: ticket-template
template_version: "0.1.3"
feature_refs:
  - FEAT-0115
  - FEAT-0109
  - FEAT-0113
ticket_id: TASK-0053
title: Persist equipped office kits and recover spatial interaction
phase: closeout
status: complete
owner: office3d
claimed_by:
priority: high
depends_on:
  - TASK-0052
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: true
created_at: 2026-07-15T04:40:00+08:00
updated_at: 2026-07-15T06:48:00+08:00
next_action: none - implementation, proof, and independent TAS-A completion review are complete
last_verification: deterministic Playwright lifecycle passed 24 measured rows with distinct center/perimeter Story timings, 156 measured shell/wall segments, restored sidecars, and zero console errors; 114 focused tests, root typecheck, production UI build, and diff check pass
decision_refs:
  - docs/features/FEAT-0115-office-kits-presence-and-camera.md
  - tickets/TASK-0052/design.md
  - tickets/TASK-0052/artifacts/cycle-36/default-camera.png
---

# TASK-0053: Persist equipped office kits and recover spatial interaction

## Summary

Turn the accepted command-office composition into a durable, selectable office
kit whose semantic prefab instances persist in `officeObjects`. In the same
operator-visible recovery loop, restore isometric zoom/pan, make Builder edits
authoritative, stabilize furniture around one company CEO plus one
`project_pulse` per project, add transient thread-lineage effects, correct avatar
scale, and recover prompt Story-mode close-ups.

The decisive boundary is semantic persistence: a storage run or command table
is one persisted prefab object; its non-editable legs, boards, trim, and bulbs
remain internal meshes. Runtime events remain transient presentation state.

## Scope

- In:
  - office-kit preview, equip, reload, customize, and reset ownership flow
  - Builder Layout -> Office Kits picker, preview, actions, conflict summary,
    and capacity/overflow state
  - persisted semantic generated objects with stable generated keys
  - safe replacement of prior kit-owned objects while preserving user objects
  - Builder Apply switching the equipped office to customized/manual ownership
  - isometric wheel/pinch zoom and pan with rotation locked
  - Story camera target-readiness and transition performance recovery
  - scene-scale contract for employees, desks, landmarks, and hit targets
  - one global CEO, one persistent `project_pulse` per project, and stable
    stations for pulses within equipped-kit capacity
  - ephemeral thread workers removed from permanent desk/layout demand
  - created/forked thread-lineage presentation effect from existing telemetry
  - complete semantic light/dark office theme roles
  - deterministic QA probes and browser regression for the full lifecycle
- Out:
  - persisting individual mesh primitives
  - arbitrary user-authored prefab packages
  - a second thread-lineage store
  - permanent desks for subagents, eval runs, or every independent thread
  - deploying or migrating remote production state

## Delta

```text
overall_before:
  - accepted layout mixes generated semantic objects with render-only architecture
  - automatic composition can reclaim Builder-edited layout on refresh
  - orbit controls are disabled to lock rotation, also disabling zoom and pan
  - project agent count drives desk demand while the renderer clamps every team to 3-5 desks
  - fixed neighborhood footprints and slots can overlap visible tables
  - employees render at 0.48 scale against much larger furniture
  - thread lineage is visible in chat data but absent from the spatial office
  - only the background materially adapts to light/dark mode
overall_after:
  - users preview and equip durable office kits
  - every editable generated prefab is persisted in officeObjects
  - Builder customizations are authoritative until explicit reset/equip
  - isometric camera supports zoom/pan while rotation remains fixed
  - stable organizational roles own furniture; ephemeral work owns temporary effects
  - kit capacity fits persistent projects without runtime-thread-driven reflow
  - Story mode promptly frames the selected employee and reports latency
  - full scene tokens resolve for light and dark mode
why_now:
  - TASK-0052 reached visual A but exposed regressions in interaction, persistence ownership, scale, and runtime semantics
problems:
  - before: generated room architecture cannot be selected or equipped as durable inventory
    after: generated semantic prefab instances are stable sidecar objects
    why_now: accepted designs must survive reload and Builder edits
  - before: runtime worker churn can reshape furniture and produce overlap
    after: one stable project pulse owns the station; subagents are transient
    why_now: the office should model organization, not process count
first_principles_basis:
  objective: make the visually accepted office durable, editable, responsive, and semantically truthful
  need: users must own an equipped office rather than watch a layout recompute
  assumptions: officeObjects, officeSettings, existing thread-lineage telemetry, and prefab renderers can carry the first slice
  root_cause: presentation, persistence, runtime presence, and camera policy were coupled through broad flags and derived agent counts
  constraints: preserve manual layouts, user objects, navigation, semantic activity targets, existing runtime adapters, and the accepted visual direction
  first_viable_slice: equip one command-office kit, reload it unchanged, customize it, show one fork effect, and prove both cameras
  proof_or_falsification: deterministic lifecycle/browser proof plus sidecar snapshots and performance timings
  tradeoff: semantic prefab granularity instead of exposing every mesh primitive
  non_goals: procedural office marketplace or arbitrary prefab authoring
```

## Change Plan

```text
architecture_signatures:
  module_level:
    - office-kit.ts / materializeOfficeKit(snapshot, roster): persisted semantic objects + settings + receipt
    - office-kit-state-bridge.ts / commitOfficeKitState(expectedRevision, settings, objects): committed | conflict | rolled_back | recovery_required
    - office-data-mapper.ts / toOfficeData(unified, settings): stable-role office projection
    - employee-position-registry.ts / upsert|remove|getLiveEmployeePosition(id, now): lifecycle-bounded live positions
    - thread-lineage-effect-model.ts / ingestLineageEdges(edges, state, now, freshnessWindowMs): bounded fresh effects
  main_flow:
    - Builder preview -> transient automatic snapshot -> Equip -> manual persisted kit
    - first Builder mutation -> persist mutation -> mark kit customized/manual
    - thread lineage query -> dedupe -> resolve live endpoints -> render -> expire
  data_flow:
    - generated scene officeObjects -> semantic kit ownership metadata -> office-objects.json
    - officeKit settings -> bridge/browser normalization -> office.json -> mapper ownership mode
    - Codex projects -> one persistent project_pulse each -> one station within capacity
    - Story invocation -> live employee registry -> camera target-ready -> camera settled timing
  builder_freeform_boundary:
    - Internal component extraction, naming, and test fixture details are builder-owned; ownership metadata, persisted schemas, capacity behavior, camera budgets, proof gates, and public QA probes require ticket regeneration if changed.
```

### Change 1: Persist the accepted command office as an equipped kit

```text
fixes:
  - generated semantic objects and kit ownership currently disappear across normalization or regenerate on refresh
before:
  - command-commons renders but is rejected by the sidecar mesh-type normalizer
  - office settings have no equipped/customized kit state
after:
  - one built-in command-office kit materializes the accepted TASK-0052 snapshot with stable semantic keys
  - one bridge-owned journaled commit detects revision conflicts and recovers partial settings/object writes
read:
  - path: ui/src/providers/office-data-mapper.ts
    reason: accepted generated snapshot and manual/automatic ownership branch
  - path: ui/src/modules/runtime/lib/openclaw/{types,normalize,adapter}.ts
    reason: closed browser persistence contracts
  - path: ui/office-settings-bridge.ts and ui/vite.config.ts
    reason: gateway normalization and sidecar writes
write:
  - path: ui/src/modules/office/lib/office-kit.ts
    change: kit types, stable keys, semantic snapshot materialization, replacement, conflict summary, capacity
  - path: ui/office-kit-state-bridge.ts and ui/vite.config.ts
    change: expected-revision endpoint, prepared journal, temp writes, ordered renames, rollback/recovery receipt
  - path: ui/src/modules/runtime/lib/adapters/contract.ts and ui/src/modules/runtime/lib/openclaw/adapter.ts
    change: saveOfficeKitState(expectedRevision, settings, objects) adapter edge
  - path: runtime/bridge normalizers and templates/sidecar/{office,office-objects}.template.json
    change: round-trip officeKit state and command-commons semantic objects
operation:
  - preserve user-owned objects; replace only objects with valid matching metadata.officeKit ownership
  - set layoutStrategy=manual on Equip so reload consumes persisted objects without regeneration
  - leave the journal for deterministic startup/next-call recovery when compensating rollback itself fails
signature_or_type_impact:
  - OfficeSettingsModel.officeKit and OfficeKitOwnedMetadata
  - CompanyOfficeObjectModel.meshType accepts command-commons
routes:
  docs: doc-advisor
  qa: tests
  review: reviewer
qa:
  - deterministic keys, preview purity, idempotent equip/reset, user-object preservation, revision conflict, first-write failure, second-write failure, rollback failure/recovery, normalizer round trip
failure_modes:
  - normalization silently drops ownership; partial write; accidental user-object claim; source snapshot changes identity
```

### Change 2: Give Builder an explicit kit lifecycle and authoritative mutations

```text
fixes:
  - users cannot preview/equip/reset a kit and Builder edits are reclaimed by automatic layout
before:
  - floor Apply and object mutations persist their local payload without setting manual/customized ownership
after:
  - Builder Layout -> Office Kits owns Preview, Cancel, Equip, conflict, Reset, and capacity states
  - the first successful floor/object mutation marks the equipped kit customized and layout manual
read:
  - path: ui/src/components/hud/builder-toolbar.tsx
    reason: existing Builder entry surface
  - path: ui/src/modules/office/scene/office-layout-editor.tsx
    reason: floor Apply owner
  - path: ui/src/modules/office/components/{interactive-object,object-transform-panel}.tsx
    reason: drag and exact-transform persistence
  - path: ui/src/modules/office/systems/placement-system.ts and ui/src/modules/office/hooks/use-delete-office-object.ts
    reason: all persisted Builder object mutations
write:
  - path: ui/src/modules/office/components/office-kit-picker.tsx
    change: concrete kit lifecycle UI and non-mutating preview state
  - path: ui/src/providers/office-data-{mapper,provider}.tsx|ts
    change: provider actions coordinate preview, equip, reset, and customization
  - path: existing Builder mutation call sites
    change: route successful mutations through the shared customization marker
operation:
  - entering Builder alone does not change ownership; only a successful mutation does
  - Cancel restores the exact pre-preview settings without adapter writes
signature_or_type_impact:
  - OfficeDataContextValue adds preview/equip/reset/markCustomized actions and preview state
routes:
  docs: doc-advisor
  qa: qa-tester
  review: reviewer
qa:
  - component flow tests plus reload proof after floor and object edits
failure_modes:
  - transient preview writes sidecars; refresh races overwrite a mutation; conflict copy hides replacement scope
```

### Change 3: Stabilize furniture around CEO and project pulses

```text
fixes:
  - volatile threads inflate desk count, forced three-desk neighborhoods waste space, and extra workers overlap the final desk
before:
  - every project agent influences planning and command neighborhoods render at least three desks
after:
  - one CEO and one office-projected project_pulse per active project own furniture
  - ephemeral workers have no desk/layout effect; reserved capacity or explicit unseated overflow replaces silent annexing
read:
  - path: ui/src/modules/runtime/lib/codex-app-server/normalizers.ts
    reason: existing PM, delegated, eval, and recent-thread classification
  - path: ui/src/providers/office-data-{mapper,refresh}.ts
    reason: desk demand, repair, and observed worker merge
  - path: ui/src/modules/office/utils/layout.ts
    reason: forced visible desk minimum
write:
  - path: the same runtime/mapper/layout owners plus ui/src/modules/office/lib/object-footprints.ts and ui/src/modules/office/systems/occupancy-system.ts
    change: stable pulse projection, capacity slots, ephemeral fan positions, leaf footprint/clearance proof
operation:
  - reuse pm internally and expose builtInRole=project_pulse only in the office projection
  - do not synthesize or annex a cluster beyond equipped-kit capacity
signature_or_type_impact:
  - office presence class and unseated overflow metadata; no global AgentRole expansion
routes:
  docs: doc-advisor
  qa: tests
  review: reviewer
qa:
  - identical layout/object signatures for 0/1/20 ephemeral workers; one station per fitted project; zero leaf/wall/path intersections
failure_modes:
  - pinned PM duplicates pulse; overflow creates furniture; ephemeral avatars share pulse coordinates
```

### Change 4: Recover isometric controls and prompt Story framing

```text
fixes:
  - one broad controls flag disables fixed-view pan/zoom and Story targets stale initial positions
before:
  - fixed mode passes orbitControlsEnabled=false to OrbitControls.enabled
  - stable orthographic rerenders can restore fitted zoom; Story activates before a live target is ready
after:
  - fixed mode independently enables bounded zoom/pan and locks rotation
  - user framing survives ordinary rerenders and Story resolves a live target before perspective handoff
read:
  - path: ui/src/modules/office/scene/{view-profile,scene-contents,office-scene-camera-rig,use-office-scene-camera,consult-camera}.ts|tsx
    reason: current camera policy and transitions
  - path: ui/src/modules/office/components/employee/use-employee-locomotion.ts
    reason: live world position owner
write:
  - path: ui/src/modules/office/scene/employee-position-registry.ts
    change: production non-reactive upsert/remove/stale-read registry; unmount removes and reads expire after 1s
  - path: ui/src/modules/office/scene/{view-profile,scene-contents,office-scene-camera-rig,use-office-scene-camera,consult-camera}.ts|tsx
    change: independent controls, relative zoom bounds, target readiness/settled instrumentation, framing restore
  - path: ui/src/modules/office/components/employee/{index,use-employee-locomotion}.tsx|ts
    change: publish live positions, remove them on unmount, and keep visual/avatar concerns separate from camera state
operation:
  - keep OrbitControls enabled in fixed mode while enableRotate=false
  - resolve stale current ID through selected employee, project pulse, then CEO fallback
signature_or_type_impact:
  - camera QA state exposes projection, controls, target, position, zoom, and Story timestamps
routes:
  docs: doc-advisor
  qa: qa-tester
  review: reviewer
qa:
  - gesture policy tests, stable rerender zoom, center/perimeter Story timing, live wandering target browser proof
failure_modes:
  - context menu fires after right-pan; projection swaps reset zoom; target registry readiness is confused with animation latency
```

### Change 5: Render fresh thread lineage as transient spatial effects

```text
fixes:
  - canonical created/forked telemetry is visible in chat but has no spatial office feedback
before:
  - the office has no lineage consumer and replaying query history would flood the scene
after:
  - first query establishes a baseline; only unseen edges whose canonical eventAt is within 10s produce one 2.2s cyan head-to-head effect
read:
  - path: convex/modules/hookTelemetry/{projections,queries}.ts and ui/src/modules/chat/hooks/use-chat-threads.ts
    reason: canonical edge source and existing consumer
  - path: employee-position-registry.ts
    reason: live endpoint resolution
write:
  - path: ui/src/modules/office/scene/thread-lineage-effect-model.ts
    change: pure baseline/dedupe/fade/expiry/endpoint model
  - path: ui/src/modules/office/scene/use-office-thread-lineage-effects.ts and office-thread-lineage-effects.tsx
    change: canonical query adapter and R3F renderer
operation:
  - resolve parent employee -> project_pulse -> CEO; child employee or 1.25-unit non-colliding projection
  - suppress late backfill/history even when its edge ID was absent from the initial baseline
  - effects remain presentation-only and absent when canonical telemetry is unavailable
signature_or_type_impact:
  - read-only active-effect QA probe; no persistence schema
routes:
  docs: doc-advisor
  qa: tests
  review: reviewer
qa:
  - mount baseline, exactly-once created/forked, late historical insertion suppression, 10s freshness boundary, fallback endpoints, 1.7s fade, 2.2s expiry, deterministic injected fixture
failure_modes:
  - historical replay; duplicate event; missing parent; effect survives cleanup; second lineage store appears
```

### Change 6: Correct scene scale and complete the command-office theme

```text
fixes:
  - avatars render at roughly half authored height and only the scene background materially changes by theme
before:
  - employee avatar scale=0.48 and accepted command-office components contain fixed colors
after:
  - one exported visual scale satisfies the employee/desk contract
  - the existing useOfficeSceneTheme seam resolves semantic floor, wall, furniture, screen, light, employee, interaction, landmark, and lineage roles
read:
  - path: ui/src/config/office-theme.ts and ui/src/modules/office/scene/use-office-scene-camera.ts
    reason: current theme primitive and duplicated observers
  - path: accepted command-office render files named in TASK-0052
    reason: minimum complete migration surface
write:
  - path: ui/src/config/office-theme.ts and ui/src/modules/office/scene/use-office-scene-camera.ts
    change: extend the existing theme resolver/observer; add no new context unless prop composition proves insufficient
  - path: ui/src/modules/office/scene/{office-instanced-floor,office-room-shell,office-lighting,office-object-renderer}.tsx
    change: migrate shell and object-dispatch materials
  - path: ui/src/modules/office/components/{desk,team-cluster,command-commons,activity-landmark,activity-landmark-destinations,interactive-object}.tsx
    change: migrate the accepted command-office component path to semantic tokens
  - path: ui/src/modules/office/components/employee/index.tsx
    change: shared visual scale and bounded hit target
operation:
  - preserve geometry and officeObject signatures across theme switches
signature_or_type_impact:
  - OfficeTheme expands semantic material roles; Employee visual scale constant is testable
routes:
  docs: doc-advisor
  qa: visual-qa
  review: reviewer
qa:
  - token completeness, geometry invariance, world-bounds ratio, light/dark screenshots at identical camera state
failure_modes:
  - one major renderer remains static-dark; larger avatars overlap seats/props; multiple MutationObservers return
```

### Change 7: Expose deterministic probes and prove the whole lifecycle

```text
fixes:
  - current tests cannot prove sidecar ownership, camera latency, lineage cleanup, or visual continuity together
before:
  - DEV probes are fragmented and the old destination-room QA recipe conflicts with the accepted kit composition
after:
  - window.__FARPLANE_QA__ exposes kit, camera, overlap, scale, presence, and effect state through one owner for one deterministic fixture
read:
  - path: qa/cookbook/office.md and ui/src/components/hud/office-menu.tsx
    reason: canonical browser proof route
write:
  - path: ui/src/modules/office/qa/office-qa-state.ts and ui/src/components/hud/office-menu.tsx
    change: scene modules update a module-owned snapshot; office-menu remains the sole window.__FARPLANE_QA__ writer and composes all getters
  - path: scripts/prove-office-kit-lifecycle.mjs
    change: Playwright runner for deterministic fixture, persistence failure matrix, camera gestures/timings, signatures, overlap/scale, lineage freshness, themes, and reset
  - path: tickets/TASK-0053/artifacts/manifest.json
    change: runner-owned artifact manifest with command, fixture, timestamps, JSON probes, screenshots, and pass/fail rows
  - path: ui/src/modules/office/README.md, docs/HISTORY.md, docs/MEMORY.md
    change: proven ownership and interaction contracts after QA
operation:
  - run preview -> equip -> reload -> customize -> reload -> capacity -> effects -> Story -> themes -> reset
signature_or_type_impact:
  - QA-only global methods; no production persistence backdoor
routes:
  docs: doc-advisor
  qa: qa-tester + visual-qa
  review: reviewer
qa:
  - npm test focused suites; npm run typecheck:root; node scripts/prove-office-kit-lifecycle.mjs --out tickets/TASK-0053/artifacts/browser-qa; independent visual grade and completion TAS-A
failure_modes:
  - proxy-only proof; live telemetry flakes; screenshot lacks current camera/fixture identity; unreviewed sidecar mutation
```

## Gap Analysis

- **Current state:** TASK-0052 supplies the accepted command-office visual
  composition, but portions remain render-derived; broad orbit-control state
  disables isometric interaction; Builder persistence and automatic layout
  ownership are not separated; and runtime worker counts still influence
  permanent furniture.
- **Production expectation:** an equipped spatial workspace survives reload,
  exposes meaningful objects to editing, preserves manual changes, separates
  organizational roles from transient compute, and provides deterministic
  camera and theme behavior.
- **Missing gaps:** kit inventory/equip state, semantic prefab ownership,
  idempotent materialization and replacement, Builder/manual transition,
  independent zoom/pan/rotation policy, measured Story readiness, stable role
  capacity, transient lineage presentation, complete scene theme roles, and
  browser-visible QA probes.
- **Comparable implementations:** no external product parity is required for
  this local product decision; the accepted TASK-0052 office, existing
  sidecar/object model, thread-lineage graph, and Three.js camera contracts are
  the grounding surfaces.
- **Recommendation:** land the full lifecycle as one ticket because equip,
  customize, camera recovery, stable presence, and QA all meet in the same
  persisted-office proof. Defer arbitrary prefab authoring and a marketplace.

## Done

```text
done_when:
  - a command-office kit can be previewed without writes, equipped, reloaded unchanged, customized in Builder, reloaded unchanged, and reset explicitly
  - every generated unit exposed to Builder is a persisted semantic officeObject with a stable generated key and kit ownership metadata
  - anything independently selectable or movable in Builder owns an officeObject; render-time children are non-interactive implementation meshes only
  - user-created objects survive kit replacement unless the operator explicitly chooses replacement
  - Builder Layout -> Office Kits supports non-mutating preview, Equip, reset, cancel, customized-office conflict summary, and capacity overflow state
  - fixed isometric supports wheel/pinch zoom and pan while rotation remains locked
  - Builder Apply makes the edited layout authoritative/manual
  - Story mode resolves and settles on the employee close-up without a perceptible multi-second stall
  - one global CEO and one project_pulse per project persist; pulses within kit capacity own stable stations
  - a new persistent project claims reserved kit capacity; exhausted capacity leaves overflow pulses visibly unseated without furniture and never silently resizes or reflows the equipped office
  - ephemeral workers do not change deskCount, collision footprints, shell dimensions, or persisted objects
  - 1-person projects render one station; table and neighborhood geometry have no overlap
  - one seeded created event and one forked event produce deduped thin cyan lineage effects and deterministic cleanup
  - the same equipped kit passes light and dark contrast review without geometry mutation
metrics_and_hard_gates:
  - isometric controls: wheel/pinch zoom from 0.65x-2.5x fitted framing; secondary/middle/Space+primary/two-finger pan; rotation remains disabled
  - Story latency: invocation-to-target-ready <= 300ms, target-ready-to-settled <= 700ms, and invocation-to-settled <= 1000ms for center and perimeter fixtures
  - layout stability: identical persisted layout/object signatures across two reloads with unchanged inputs
  - ephemeral stability: identical layout/object signatures for 0, 1, and 20 seeded ephemeral workers
  - scale: employee world height is 1.8-2.4x desk-worktop height; employee hit capsule width >= 0.45 world units
  - overlap: zero leaf-furniture intersections, zero furniture/wall intersections, and >= 0.65 world units of required circulation clearance
  - thread effects: parent fallback is employee -> project_pulse -> CEO; child fallback is a non-colliding 1.25-unit projection; exactly-once presentation lasts 2.2s and fades for the final 0.5s
  - visual rubric: TASK-0052 composition remains A-quality in both themes
required_tas: TAS-A
required_evidence:
  - sidecar snapshots for preview/equip/customize/reset lifecycle
  - screenshots: kit preview, equipped isometric, Builder customized, Story close-up, light mode, dark mode
  - short capture or frame sequence of created/forked lineage effects
  - camera timing JSON and layout/overlap probe JSON
  - QA report and completion-review receipt linked in this ticket
```

## QA Strategy

```text
qa_strategy:
  proof_weight: visual_qa + browser lifecycle + tests
  checks:
    - pure kit materialization, ownership, idempotency, replacement, and rollback tests
    - camera policy and target/transition timing tests
    - stable-role/ephemeral classification and desk-capacity tests
    - rendered leaf-furniture bounds, wall intersection, and circulation-clearance tests
    - thread-lineage effect dedupe, endpoint resolution, and cleanup tests
    - theme-token completeness and contrast assertions
    - root typecheck and relevant office/runtime focused suites
    - grounding evidence: official Three.js OrbitControls contract plus maintained local renderer/adapter examples before finalization
  manual:
    - run preview -> equip -> reload -> Builder edit -> Apply -> reload -> reset
    - wheel/pinch zoom and pan in fixed isometric; confirm rotation is locked
    - enter/exit Story for center and perimeter employees and compare measured latency
    - inspect employee/table scale and all four neighborhood intersections
    - switch light/dark mode without changing office geometry
  delegated_lanes:
    - visual-qa against TASK-0052 cycle-36 baseline
    - browser QA for lifecycle and camera controls
    - completion reviewer for persistence safety and evidence reconciliation
  review:
    - rubric: persistence ownership, interaction recovery, spatial clarity, runtime truthfulness, visual continuity
      required_tas: TAS-A
  evidence:
    - tickets/TASK-0053/artifacts/browser-qa/
    - tickets/TASK-0053/artifacts/probes/
    - tickets/TASK-0053/artifacts/reviews/
  goal_advisor_inputs:
    proof_route: lifecycle browser QA plus independent visual and completion review
    final_evidence: equipped isometric, Builder, Story, lineage effect, and both theme screenshots
    final_checkpoint: TAS-A evidence reconciliation with no unrun lifecycle step
  residual_risk:
    - equip/replace semantics touch persisted local sidecars and require rollback proof before broad use
```

## Docs Strategy

```text
docs_strategy:
  outcome: update_docs
  doc_targets:
    - docs/features/FEAT-0115-office-kits-presence-and-camera.md
    - ui/src/modules/office/README.md
    - qa/cookbook/office.md
    - docs/HISTORY.md
    - docs/MEMORY.md for the final proven persistence and presence invariants
  validation:
    - feature index links resolve
    - office docs distinguish semantic persisted prefabs from internal mesh children
    - QA cookbook contains deterministic kit, camera, Story, lineage, and theme proof paths
```

## Agent Contract

- **Open:** `npm run ui`, then `/office`; `Alt+Shift+B` opens Builder.
- **Test hook:** extend `window.__FARPLANE_QA__` with read-only
  `getOfficeKitState()`, `getCameraState()`, `getThreadEffects()`, and a dev-only
  seeded lineage-event command. Add a deterministic office-kit fixture command
  or script rather than depending on live threads.
- **Stabilize:** seed the TASK-0052 command-office kit, one CEO, two projects,
  one project pulse each, and fixed created/forked events; pause unrelated
  telemetry refresh during the deterministic proof.
- **Inspect:** office kit/source/customization state, active camera projection,
  controls flags, target-ready/settled timestamps, semantic object count,
  occupancy intersections, stable layout signature, employee presence class,
  and active lineage-effect event keys.
- **Key screens/states:** kit preview, equipped office, Builder customized,
  isometric controls, Story close-up, created/forked effect, light mode, dark
  mode, and kit reset conflict state.
- **Design baseline:** `tickets/TASK-0052/design.md` and cycle-36 screenshot.
- **QA cookbook:** `qa/cookbook/office.md`.
- **Taste refs:** `docs/TASTE.md`; preserve the dense restrained founder-control-room direction.
- **Expected artifacts:** lifecycle screenshots, sidecar snapshots, camera timing
  report, overlap report, lineage capture, light/dark comparison, QA and review receipts.
- **Delegate with:** `TASK-0053`, this ticket's `Done` and `Agent
  Contract`; recommended owner `office3d`; write evidence under
  `tickets/TASK-0053/artifacts/` and update this ticket's verification fields.

## Run Hints

- **Likely size:** epic
- **Goal recommendation:** required
- **Budget hint:** multi-pass local implementation, browser QA, visual QA, persistence review, and operator feedback
- **Compute hint:** local_shared
- **Planning hint:** impl_plan
- **QA source:** QA Strategy and `qa/cookbook/office.md`
- **Batchability:** single-ticket
- **Batch reason:** persistence, layout, camera, presence, and effects converge on one equipped-office lifecycle and proof surface
- **Human inputs/assets:** TASK-0052 accepted office screenshot and operator feedback in the current task
- **Credentials / external access:** none for deterministic fixture proof; live Codex/Convex optional for corroboration
- **Compute/runtime needs:** Vite Office3D, local sidecar bridge, deterministic fixture telemetry
- **Tooling gaps:** add camera/kit/effect QA probes before browser proof
- **QA risks:** sidecar mutation, WebGL/HMR context loss, timing flakes, live telemetry churn, and false overlap from internal mesh children
- **Human gates:** product contract approved by the operator; later approve the final equipped-office UX
- **Agent decision boundaries:** do not mutate remote state, delete user objects, or promote every mesh primitive without explicit approval

## Links

- `program:` `tickets/TASK-0053/program.md`
- `progress:` `tickets/TASK-0053/progress.md`
- `visual companion:` `tickets/TASK-0053/diagrams.md`
- `artifacts:` `tickets/TASK-0053/artifacts/` after implementation starts
- `review:` `tickets/TASK-0053/artifacts/reviews/implementation-plan-review.md` (TAS-A)
- `completion review:` `tickets/TASK-0053/artifacts/reviews/completion-review.md` (TAS-A)
- `refs:`
  - `docs/features/FEAT-0115-office-kits-presence-and-camera.md`
  - `tickets/TASK-0052/ticket.md`
  - `tickets/TASK-0052/design.md`
  - `qa/cookbook/office.md`

## Notes

- This is the minimal implementation plan that satisfies the selected lifecycle;
  marketplace, arbitrary prefab authoring, and a second lineage store remain out.
- Persisted prefab granularity is the safety valve: editable units persist;
  internal mesh construction remains encapsulated.
- Live thread-lineage telemetry already exposes `created` and `forked` edges;
  reuse it rather than inventing Office3D lineage state.
- The current Story transition code is nominally bounded, so implementation
  must measure target-resolution latency separately from camera animation before
  attributing the stall to rendering quality.
- Official grounding: Three.js `OrbitControls` keeps global `enabled` separate
  from `enableRotate`, `enablePan`, and `enableZoom`; fixed isometric must keep
  the controls instance enabled and lock rotation independently.

```text
plan_qa:
  minimal_required_version: pass
  reuse_before_new_surface: pass
  least_parameters: pass
  new_files_functions_justified: pass
  minimal_impl_plan_claim: pass
  existing_service_fit: pass
  goal_advisor_ready: pass
  clarifying_questions: pass
  architecture_signatures: pass
  change_plan_signature_linkage: pass
  change_plan_locality: pass
  qa_strategy_explicit: pass
  docs_strategy: pass
  independent_plan_review: pass
  visual_companion_boundary: pass
  visual_companion_colored_delta: pass
  grounding_evidence: pass
  highest_risk: recoverable two-sidecar persistence and mapper repair must not partially commit or annex an equipped office
  fix_or_deferral: staged rollback is required now; arbitrary prefab authoring remains deferred
```
