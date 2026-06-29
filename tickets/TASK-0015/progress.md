---
ticket_id: TASK-0015
kind: goal-progress
status: done
created_at: 2026-06-25
updated_at: 2026-06-25
---

# TASK-0015 Progress

## 2026-06-25

- Created Goal Packet for registry-backed Template Tracking.
- Grounded the decision in the Farplane template registry:
  `rules/template-registry.toml` and generated `docs/templates/registry.jsonl`.
- Next: implement registry-backed scan, policy fields, UI rows, docs, and
  verification.

## 2026-06-25 Closeout

- Implemented registry-backed Template Tracking:
  - `/farplane/harness/template-tracking-scan` now prefers Farplane
    `docs/templates/registry.jsonl`.
  - UI-local template families remain as fallback when the registry is
    unavailable.
  - Payload rows now include `installTarget`, `historyPolicy`,
    `consumerScope`, `registryPath`, `templateVersion`, and `usedVersion`.
- Updated the Template Tracking table to show maintainability policy columns:
  Install, Owner, Scope, History, Raw adoption, Hot Debt, and Next action.
- Updated Harness OS docs with the ownership rule:
  templates stay with their owner surface; the registry is the one-place UI
  catalog; install targets describe runtime materialization.
- Verification passed:
  - `npm run typecheck:root`
  - `npm run ui:build`
  - `git diff --check`
  - `curl /farplane/harness/template-tracking-scan`
  - Playwright `/template-tracking` screenshot with no console/page errors
- Endpoint proof:
  - `registryStatus: loaded`
  - `schemaVersion: 1.1.0`
  - `families: 9`
  - first family `farplane-framework`
  - first install target `project-scaffold`
  - first history policy `git`
- Evidence:
  - `tickets/TASK-0015/artifacts/template-tracking-registry-backed.png`
- Residual note:
  - No Farplane template source files were moved; that was intentionally out of
    scope for this ticket.

## 2026-06-25 Correction Pass

- Reworked the visible Harness OS IA to match the accepted object split:
  `Map`, `Features`, `Templates`, and `Projects`.
- Removed the separate Lifecycle tab from Harness OS; lifecycle now informs the
  `Framework Core` graph filter instead of acting as a fifth top-level surface.
- Rebuilt Features as a registry table plus right-side detail inspector with
  filters for implemented, partial, proposed, and needs-spec rows.
- Rebuilt Templates as a registry database and detail inspector, removing the
  skill-debt chart layout from this tab. Skill rollout belongs in Skill OS.
- Rebuilt Projects as the active-project rollout dashboard:
  active manifest donut, active score, project states, manifest versions,
  template pins in manifests, project index, and project inspector.
- Updated Harness OS module docs and office-panel descriptions to preserve this
  object split.
- Verification passed after this correction:
  - `npm run typecheck:root`
  - `npm run ui:build`
  - `git diff --check`
  - Playwright screenshots for Harness OS, Features, Templates, and Projects
    with no console/page errors.
- Evidence:
  - `tickets/TASK-0015/artifacts/harness-os-four-tabs.png`
  - `tickets/TASK-0015/artifacts/harness-features-registry.png`
  - `tickets/TASK-0015/artifacts/harness-templates-registry-db.png`
  - `tickets/TASK-0015/artifacts/harness-projects-rollout.png`
