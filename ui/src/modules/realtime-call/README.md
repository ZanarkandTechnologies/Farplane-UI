# Realtime Call

Scoped voice calls between the operator and locally configured Farplane agents.

The module owns employee selection state, local profile discovery, session creation, and the
LiveKit call surface. Mount `RealtimeCallDialog` inside `OfficeDataProvider`, then open it through
`useRealtimeCallStore`.

The browser requests a session with `{ scope, projectPath, agentIds }`. The local server reloads
those agent IDs from `farplane/agents.yaml` and forwards only validated profiles to LiveKit
dispatches. Project calls derive their path from the live company model. Office calls always load
the Farplane UI root profiles and ignore any browser path.

Calls intentionally reject mixed-project selections and selections mixing office specialists with
project workers. Camera and screen-share controls publish real browser media; profiles with
`vision.mode: "turn_snapshot"` receive snapshots only through the realtime agent runtime after
completed turns. Group-call workers remain silent unless their configured display name appears in
the completed operator turn.

An optional `appearance` block (`accent`, `skinTone`, `hairColor`, `eyebrows`) renders a stable,
flat monitor-style face in setup, the read-only View Agent inspector, and connected calls. Its
mouth opens only from the subscribed participant's real LiveKit audio level.

## Operator flow

1. Hold Ctrl (Cmd on macOS) and click each employee to add them to the call roster.
2. Use the floating `Call N` launcher; every selected employee is dispatched into one room.
3. Start the call to publish the microphone immediately; the in-call microphone control mutes or
   resumes it. Camera and screen share remain off until explicitly enabled.
4. Start both Doppler-backed processes before testing real audio:

   ```bash
   doppler run -- corepack pnpm run ui
   doppler run -- corepack pnpm run realtime:agent
   ```

The setup and connected stages use almost the full viewport. On narrow screens the agent tiles
stack inside a scrolling stage while the call controls remain pinned.
