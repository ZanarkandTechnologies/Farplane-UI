---
ticket_id: TASK-0009
status: active
created_at: 2026-06-24
updated_at: 2026-06-24
---

# Progress: TASK-0009

## 2026-06-24 Initial Packet
- Created Goal Packet for bounded office runtime-debugging stabilization.
- Prior council round identified six evidence-backed bug classes:
  structural signature timestamp drift, live-status employee churn, loading
  scene teardown, wall/furniture collisions, repair/render district mismatch,
  and one-tile lane occupancy mismatch.
- Next: patch high-confidence provider/scene fixes first, then run another
  council round.

## 2026-06-24 Round 1 Patch
- Fixed volatile structural signatures by excluding `configSnapshot.stateVersion`
  from office structural refresh signatures.
- Fixed live-status churn by applying live status directly to the world store
  instead of rebuilding `toOfficeData()` on status-only updates; reconciliation
  now treats `live-status` as non-structural even if a snapshot carries changed
  employee status fields.
- Fixed scene teardown on re-entered loading by preserving the office scene
  shell after the first successful render.
- Verification passed:
  - `npx vitest run ui/src/components/office-bootstrap.test.ts ui/src/providers/office-data-provider.test.ts ui/src/modules/office/store/office-world-reconciliation.test.ts ui/src/modules/office/lib/office-area-layout.test.ts ui/src/modules/office/lib/office-section-walls.test.ts ui/src/modules/runtime/lib/openclaw/normalize-office-settings.test.ts`
  - `npm run typecheck:root`
- Next: run council round 1 after patch to find remaining in-scope issues.

## 2026-06-24 Round 1 Council And Second Patch
- Council findings:
  - Live-status direct store updates needed a render-time overlay path.
  - Adapter live-status polling was skipped on unchanged structural polls.
  - Observed Codex statuses were blocked when Convex status rows were absent.
  - Object ref callback churn and registration no-op misses could re-run nav
    grid on ordinary scene renders.
  - Nav bootstrap marked ready after the first registered object instead of all
    expected obstacles.
  - Canvas key included `forcePerspective`, causing avoidable remounts.
  - One-tile lanes should remain open circulation instead of hosting divider
    walls.
- Fixed:
  - Added scene-level live-status overlay for employee presentation and skill
    target/effect positions without mutating structural employees.
  - Kept adapter live-status refresh active even when structural polls skip.
  - Let observed Codex status-only changes update live status without Convex
    rows.
  - Made object registration no-op for identical register/missing unregister.
  - Cached registered object ref callbacks per object id.
  - Required all expected objects before nav grid initialization.
  - Simplified Canvas key to camera projection only.
  - Stopped generating divider walls across minimum one-tile lane gaps.
- Verification passed:
  - `npx vitest run ui/src/providers/office-data-provider.test.ts ui/src/modules/office/scene/use-office-scene-derived-data.test.ts ui/src/modules/office/store/object-registration-store.test.ts ui/src/modules/office/store/office-world-reconciliation.test.ts ui/src/modules/office/lib/office-section-walls.test.ts ui/src/components/office-bootstrap.test.ts`
  - `npm run typecheck:root`
- Remaining known risk for Round 2:
  - Generated divider walls are still not clipped against preserved sidecar
    furniture in the mapper sequence. This may need a broader placement-order
    refactor unless a narrow evidence-backed patch is found.

## 2026-06-24 Round 2/3 Council And Final Patch
- Round 2 findings:
  - Scene live-status overlays had drifted from the canonical
    `deriveEmployeeActivity` mapper.
  - Navigation grid readiness did not reset/rebuild when object transforms or
    geometry-relevant metadata changed without changing object count.
- Round 2 fixes:
  - Reused `deriveEmployeeActivity` for scene presentation overlays.
  - Added an office-object navigation signature and readiness reset path so
    obstacle placement changes rebuild pathfinding without remounting the
    canvas.
- Round 3 findings:
  - Local observed Codex fetch failures could clear observed-only workers,
    making employees disappear until the next successful telemetry fetch.
  - Unknown/non-rendered mesh types were counted as navigable obstacles, which
    could permanently stall navigation readiness.
  - Team/table/furniture geometry changes were missing from the nav obstacle
    signature.
  - Generated divider walls could still win over locked sidecar furniture or
    nudge away from treemap boundaries when fully blocked.
  - Background nav rebuilds could flash the loader after the office had already
    rendered once.
- Round 3 fixes:
  - Kept last local observed Codex workers through transient fetch failures.
  - Added shared navigation helpers that count only renderable/registerable
    obstacles and include table station counts, desk counts, furniture ids,
    custom mesh load signatures, footprints, transform, and team ids in the
    obstacle signature.
  - Preserved locked sidecar furniture before placing movable furniture and
    made generated divider walls clip/drop around obstacles instead of nudging
    into non-boundary space.
  - Kept the loader quiet during background navigation rebuilds after the first
    successful nav-ready state.
- Verification passed:
  - `npx vitest run ui/src/providers/office-data-provider.test.ts ui/src/modules/office/scene/use-office-scene-derived-data.test.ts ui/src/modules/office/scene/office-object-navigation.test.ts ui/src/modules/office/store/object-registration-store.test.ts ui/src/modules/office/store/office-world-reconciliation.test.ts ui/src/modules/office/lib/office-section-walls.test.ts ui/src/components/office-bootstrap.test.ts`
  - `npm run typecheck:root`
- Browser QA attempted:
  - Started UI dev server with `npm run ui -- --host 127.0.0.1 --port 5178`.
  - Playwright reached `/office` and found one canvas, but headless Chromium
    failed to create a WebGL context in this environment, leaving the loader
    visible. Screenshot: `/tmp/farplane-office-task-0009.png`.
- Residual risk:
  - Browser/visual QA remains blocked by headless WebGL context creation;
    final reliable proof is focused unit coverage plus root typecheck.
  - Nested project hierarchy lane/wall visuals may still deserve a dedicated
    visual QA ticket if the user sees another concrete screenshot regression.
