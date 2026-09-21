---
owner: hook-telemetry
status: active
updated: 2026-09-20
---

# Hook Telemetry QA Runbook

## Mechanical Checks

```bash
npm run typecheck
npm run lint
npm run test:once -- hooks/file-change-listener convex/modules/hookTelemetry ui/src/store/app-store.test.ts ui/src/components/hud/office-panel-registry.test.ts
```

## Browser Checks

1. Start `npm run ui`.
2. Open the office as an operator.
3. Open the office launcher and choose `Raw Telemetry` / `Project Timeline`.
4. Verify `Events` renders either a table of hook rows or the empty state.
5. Switch to `Hooks` and verify the hook list, file-change detail, install
   command, `/hooks` trust chip, summary toggle, active patterns, manifest
   selection, and recent preview render without nested scrolling fights.
6. Switch to `Programs` and verify routing previews render as non-executing
   subscriptions with sample matches or an empty state.
7. Switch to `Raw` and verify the raw table remains available.
8. Switch to `Distribution` and verify event/hook/session bars fit in the panel.
9. Disable Convex for the UI session and verify the unavailable state appears.
10. Open the office in viewer/public mode and verify `Raw Telemetry` is not
   available from the launcher. If forced open from state, verify the locked
   state appears and no raw query is issued.

## Privacy Checks

- Payload preview must show only curated fields: `eventName`, `message`,
  `skillId`, `threadId`, and capped `paths`.
- Do not show raw `cwd`, tool inputs, tool responses, stdout, stderr, or
  transcript fields in the table preview.

## Stop / continuation presence

1. Observe a root task through `UserPromptSubmit`, then a `Stop` hook.
2. Verify its office status reads “Codex stop attempted” and is idle, without
   claiming that the task or Goal is complete. Raw Telemetry retains `Stop`.
3. Continue the same turn and observe a `PostToolUse` event for that worker.
   Verify it returns to running without requiring another user prompt.
4. Observe `SubagentStart` and `SubagentStop`: the child is ephemeral and its
   stop does not mark the parent complete.
5. Preserve a capture for each root transition. If the selective tool hooks do
   not emit an event, mark resumed presence unproven; do not invent a signal.

The local-provider and Convex projection tests exercise these states offline;
cloud verification requires the updated Convex functions to be deployed.
