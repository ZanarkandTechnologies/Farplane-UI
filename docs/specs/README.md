# Specs

Behavior specs for Farplane UI.

Use this index when planning or implementing changes that touch product
contracts, runtime adapters, sidecars, workflow state, or UI behavior.

## Current Specs

### Farplane Testament

- `FP01-operator-intelligence-modules-roadmap.md` - operator-intelligence
  module roadmap and global/project scope split.
- `FP02-harness-product-model.md` - canonical product model: Farplane as the
  cloneable harness substrate, Farplane UI as the cockpit, global modules for
  harness operation, and project modules as autonomous company views.

### Legacy SC Specs

- `module-shell-architecture.md`
- `SC01-spec-openclaw-state-mapping.md`
- `SC02-spec-notion-plugin-inrepo.md`
- `SC03-spec-ui-memory-skills.md`
- `SC04-spec-chat-bridge-openclaw.md`
- `SC06-spec-kanban-federation-sync.md`
- `SC07-spec-ticket-session-lifecycle.md`
- `SC08-spec-provider-context-indexing-and-skill-gen.md`
- `SC09-spec-agent-personalization-and-mesh-wrapper.md`
- `SC10-spec-heartbeat-autonomy-loop.md`
- `SC11-spec-affiliate-marketing-mvp.md`
- `SC12-spec-board-native-task-planning-review.md`
- `SC12-spec-skill-orchestration-and-workflow-wizard.md`
- `SC13-spec-qa-panel-access-instrumentation.md`

## Planning Rule

For new behavior, update or add a spec before implementation when the change
affects runtime contracts, sidecar shape, workflow state, permissions, or UI
surfaces used by multiple features.

New product doctrine should use the `FP##-*` convention. Existing `SC*` files
are legacy source material unless a ticket explicitly says otherwise.
