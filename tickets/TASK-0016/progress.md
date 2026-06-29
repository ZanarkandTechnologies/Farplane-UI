---
ticket_id: TASK-0016
kind: progress-log
status: active
created_at: 2026-06-25
updated_at: 2026-06-25
---

# Progress

## 2026-06-25
- Created ticket and Goal Packet for manifest-backed Framework Core graph projection.
- Accepted operator constraints: use `farplane/manifest.json`, include/exclude matcher semantics, keep source-to-source connector paths, classify unknown connector nodes as `other`, and avoid hardcoded script policy.
- Added `farplane_graph.framework_core` to the Farplane manifest.
- Added `farplane-framework-core` projection profile and generator. First generation produced 863 nodes, 4056 edges, 37 source nodes, 0 isolated source nodes, and 559 `other` nodes.
- Swapped Harness OS Map to fetch `farplane-framework-core-graph.json` and removed UI keyword filtering.
- Regenerated final Framework Core graph: 863 generated nodes, 4058 generated edges, 37 source nodes, 0 isolated sources, and 561 `other` nodes. Harness OS Map renders 874 nodes and 4115 edges after UI feature overlay.
- Verification passed: focused Python py_compile, lifecycle/framework graph unit tests, `generate_graph_projection.py --projection farplane-framework-core --check`, Farplane `git diff --check`, Farplane-UI `npm run typecheck:root`, Farplane-UI `npm run ui:build`, Farplane-UI `git diff --check`, and browser screenshot with no console/page errors.
- Evidence: `tickets/TASK-0016/artifacts/harness-framework-core-map.png`.
- Follow-up correction: replaced recursive child expansion with source-intersection connector paths. Regenerated Framework Core graph now has 405 generated nodes and 2266 generated edges, while keeping manifest sources and `other` connector visibility without adding mode or hop-limit manifest fields.
- Recaptured Harness OS browser proof after the correction. The UI renders 416 nodes and 2319 edges after feature overlay, shows `source`, `linked`, and `other` roles, and reported no console/page errors.
- Added a UI-side root/depth lens for Harness OS Map. The default starts at `docs/farplane-framework/README.md` with directed depth `2`, reducing the first rendered map to 115 visible nodes and 511 visible edges while keeping `All` available for full graph audit.
- Evidence: `tickets/TASK-0016/artifacts/harness-framework-core-map-depth-lens.png`.
- Final correction: replaced source-intersection connector expansion with a lifecycle/workflow projection. Manifest source anchors are now the 7 key `docs/farplane-framework/*.md` files; the generator keeps direct framework file/spec refs and adds skill nodes when those docs mention installed skill names.
- Regenerated Framework Core graph: 51 generated nodes, 125 generated edges, 7 source docs, 30 skills, 5 specs, 9 Farplane files, and 0 `other` nodes. Harness OS Map renders 62 nodes / 131 edges after feature overlays, with a default visible lens of 45 nodes / 119 edges.
- Evidence: `tickets/TASK-0016/artifacts/harness-framework-core-lifecycle-map.png`.
- Added workflow-spine nodes and ordered workflow edges. The generated graph now has 58 nodes / 176 edges: 7 workflows, 7 source docs, 30 skills, 5 specs, 9 Farplane files, and 0 `other` nodes. Workflow edges include `workflow-stage`, `workflow-skill`, `workflow-next`, and curated lifecycle `routes_to` edges. Skill heat is copied onto skill nodes and used as graph node weight.
- Harness OS Map now defaults to `workflow:lifecycle` with visible lens 30 nodes / 62 edges and labels the root as `Farplane lifecycle`.
- Evidence: `tickets/TASK-0016/artifacts/harness-framework-core-workflow-spine.png`.
