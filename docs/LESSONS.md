# LESSONS

Distilled lessons from repeated trouble, review passes, QA passes, and
implementation corrections.

Use `docs/TROUBLES.md` for raw pain and failed attempts first. Promote only
durable lessons here, then promote true invariants into `docs/MEMORY.md` or the
relevant project/skill contract.

## Template

```text
YYYY-MM-DD | area | lesson

Context:
- What repeated issue or correction caused this?

Lesson:
- What should future agents do differently?

Promote:
- Keep here / move to MEMORY / move to PROJECT_RULES / move to skill
```

2026-06-30 | telemetry/event-miner | Hookless agents must be artifact-only at both runtime and prompt layers

Context:
- A hookless event-miner child was launched with hooks disabled, but its prompt still suggested direct telemetry publishing, causing user confusion about ownership boundaries.

Lesson:
- When a child agent is meant to be hookless, remove direct publish/API/secret instructions from its prompt and make the parent hook/server side the only telemetry publisher.

Promote:
- Keep here / move to event-miner hook contract if repeated.

2026-06-30 | mining/ui | Cross-project mine artifact links need explicit project scope

Context:
- A timeline Open Mine Run action for TASK-0250 opened a stale artifact from the UI repo because the target carried only run/output ids and the bridge fell back to the default project mine root.

Lesson:
- When UI controls open local mining artifacts for another project, carry projectPath with runId/outputId through every state boundary and reset derived targets when the active project changes.

Promote:
- Keep here / move to Thread Data or mining bridge contract if repeated.

2026-07-15 | office/layout | Validate rendered bounds and semantic inventory, not placement proxies alone

Context:
- A command-office composition passed collision checks while render-only furniture crossed into team neighborhoods, and the scene silently carried only two of thirteen supported activity rooms.

Lesson:
- A spatial acceptance report must use the final visual footprint for intersection and shell checks, then separately assert that every required semantic destination exists exactly once.

Promote:
- Keep in the office quality validator and browser proof contract.

2026-07-15 | office/visual-integrity | Collision fixes must preserve accepted scene richness

Context:
- A technically passing collision correction deleted the command-office beams and reduced every activity destination to a generic sphere or box.

Lesson:
- Treat accepted architectural rhythm and semantic prop identity as preservation constraints. Resize, relocate, or bind them to shared geometry contracts; do not remove them merely to improve collision or performance scores.

Promote:
- Keep in the office interior-design and visual QA correction loop.

2026-07-15 | office/activity-rooms | Semantic rooms need actions and furnishing contracts

Context:
- All canonical activity destinations could be present and collision-free while most still had no panel action and read as unfurnished display patches.

Lesson:
- Treat a first-party room as one contract spanning canonical identity, a registry-valid interaction binding, persisted style metadata, renderer-owned decor, and inventory proof. Geometry alone does not make the room complete.

Promote:
- Keep in the canonical activity-room catalog and browser lifecycle proof.

2026-07-22 | youtube/extension | Thumbnail overlays need local stacking ownership

Context:
- The Analyze control was appended to the thumbnail but kept a maximum-integer
  z-index, allowing it to paint above YouTube's sticky navigation.
- A later recommendation renderer used a new camel-case thumbnail class; the
  selector fallback silently treated the whole row as the thumbnail and moved
  the control over metadata.

Lesson:
- Treat overlay ownership as geometry plus stacking: establish an isolated
  thumbnail stacking context and use the smallest local z-index that clears
  thumbnail media overlays.
- Validate every renderer by comparing the control and actual thumbnail
  rectangles. A mounted control count cannot prove correct ownership.

Promote:
- Keep in the YouTube shortcut mount and browser scroll proof contract.

2026-07-22 | youtube/extension | Verify theme and project ownership across popup, Shadow DOM, and task metadata

Context:
- The popup matched Farplane, but the isolated thumbnail Shadow DOM retained an
  amber rounded skin and new Codex tasks inherited the bridge repo cwd.

Lesson:
- Theme corrections must inspect every isolated rendering root, not just the
  extension popup. For persistent Codex work, verify the saved task `cwd`
  against the registered desktop project root because app-server thread start
  is workspace-based rather than desktop-project-id based.

Promote:
- Keep in the YouTube shortcut visual and runtime proof contract.

2026-08-03 | office/runtime | Treat impossible provider-context errors as possible module-generation splits

Context:
- The office threw R3F's outside-Canvas error from a correctly nested `OrbitControls`. The stack referenced a Fiber chunk already absent from Vite's current dependency cache while Drei resolved through the new shared chunk.

Lesson:
- When a context hook says its provider is missing but component ancestry is valid, compare the browser's dependency chunk ids with the active optimizer metadata. Explicitly pre-bundle tightly coupled provider/hook packages in one startup batch, then prove the fix after a cold browser load.

Promote:
- Keep in the office runtime-debugging and Vite dependency proof contract.
