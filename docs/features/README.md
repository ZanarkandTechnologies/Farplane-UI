---
kind: features-index
status: active
project: Farplane UI
created_at: 2026-06-28
updated_at: 2026-08-05
framework_template_version: "1.6.4"
owner: harness
related_systems: ../systems/README.md
---

# Feature Docs

Canonical feature specs live here once ideas move past exploration. Each
first-class Farplane UI capability should have one `FEAT-*.md` owner file with
behavior, surfaces, evidence, limits, and metadata.

Generated registries such as `docs/features/registry.*` are views over these
files, not hand-authored source of truth. System/product-layer grouping lives
in `docs/systems/` and should point back to the feature docs it owns.

## Current Feature Specs

### Product Doctrine

- `FEAT-0001-operator-intelligence-modules-roadmap.md`
- `FEAT-0002-harness-product-model.md`
- `FEAT-0003-taste-bank-and-tasty-packs.md`
- `FEAT-0004-module-shell-architecture.md`

### Runtime And Workflow Capabilities

- `FEAT-0101-openclaw-state-mapping.md`
- `FEAT-0102-notion-plugin-inrepo.md`
- `FEAT-0103-ui-memory-skills.md`
- `FEAT-0104-chat-bridge-openclaw.md`
- `FEAT-0106-kanban-federation-sync.md`
- `FEAT-0107-ticket-session-lifecycle.md`
- `FEAT-0108-provider-context-indexing-and-skill-gen.md`
- `FEAT-0109-agent-personalization-and-mesh-wrapper.md`
- `FEAT-0110-heartbeat-autonomy-loop.md`
- `FEAT-0111-affiliate-marketing-mvp.md`
- `FEAT-0112-board-native-task-planning-review.md`
- `FEAT-0113-qa-panel-access-instrumentation.md`
- `FEAT-0114-dashboard-projection-architecture.md`
- `FEAT-0115-office-kits-presence-and-camera.md`
- `FEAT-0116-global-finance-observations.md`
- `FEAT-0117-video-intelligence.md`
- `FEAT-0118-realtime-employee-calls.md`
- `FEAT-0119-hosted-operating-rooms.md`
- `FEAT-0120-leverage-resource-workspace.md`

## Planning Rule

For new durable behavior, add or update a `FEAT-*.md` file before
implementation when the change affects product behavior, runtime contracts,
sidecar shape, workflow state, permissions, or UI surfaces used by multiple
modules.
