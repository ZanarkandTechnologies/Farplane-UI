---
kind: feature-spec
status: active
project: Farplane UI
created_at: 2026-08-02
updated_at: 2026-08-02
owner: realtime-call
related_systems:
  - ../systems/README.md
source_refs:
  - ../../farplane/agents.yaml
  - ../../ui/server/agent-profiles.ts
  - ../../ui/server/realtime-call.ts
  - ../../ui/src/modules/realtime-call/README.md
  - ../../apps/realtime-agent/src/agent.ts
external_grounding:
  - official LiveKit Agents Node documentation and examples
  - official LiveKit React Components documentation
---

# Realtime Employee Calls

Farplane operators can call one employee directly or Ctrl/Cmd-click several
employees from one project or the executive office and start a shared LiveKit room. A tracked
`farplane/agents.yaml` overlay supplies presentation, voice, and optional
turn-snapshot vision without replacing the canonical runtime `agentId` or
company lifecycle model.

## Profile Contract

`load_project_profiles(projectPath) -> agentId-keyed browser projection`

- The profile fields are independently useful: `name`, `title`, `background`,
  `portrait`, optional procedural monitor-face `appearance`, `voice`, and
  `vision.mode`.
- `appearance` contains only reusable identity tokens: accent, skin tone, hair
  color, and eyebrow geometry. It powers the call tile and profile inspector;
  the portrait remains the fallback asset.
- `voice` implies a realtime voice participant; there is no redundant
  `realtime.enabled` field.
- Portraits must be project-relative and are served through a contained local
  bridge path.
- The UI marks every loaded project profile with `Local override`.
- LiveKit credentials stay in Doppler-injected `LIVEKIT_*` environment values.

## Call Contract

- Ordinary employee click keeps the radial action menu; Ctrl/Cmd-click toggles
  a separate purple call roster selection.
- A direct `Call` employee action and the floating `Call N` roster launcher
  reach the same setup dialog.
- One call may contain one to eight unique agents from exactly one trusted scope.
- Finance, People Operations, and Office Manager are persistent office personas
  seated with the CEO; they can share an office-scoped call without belonging to
  a project or consuming a continuously running worker.
- Office specialists and project workers cannot be mixed in the same call in
  this slice.
- The server reloads selected profiles from the tracked project file before
  dispatch, so browser-supplied persona or voice configuration is not trusted.
- One explicit dispatch creates one named LiveKit participant per agent.
- In group calls, an agent responds only when its configured name appears in
  the completed user turn. General `team` or `everyone` prompts stay silent.
- The call dialog uses a near-full-screen stage; multi-agent tiles expand across
  desktop space and stack into a scrollable column on narrow screens.

## Text Chat Contract

- Every executive specialist exposes `Chat`, `Call`, and `View Agent` actions.
- In Codex mode, the first text message creates one named backing thread with
  developer instructions derived from the validated profile's identity and
  background. Later messages reuse that thread.
- Backing threads are hidden from ordinary office worker projections, preventing
  duplicate employees while retaining durable conversation history.
- The composer remains disabled until the local profile loads. A sent Codex turn
  stays pending until it completes or returns a visible terminal runtime error.

## Media And Vision Contract

- Starting a call publishes the microphone immediately; mute, camera, and screen share remain
  operator-controlled in the call surface.
- Procedural face tiles display stable colors and eyebrows, speaking state, an
  audio waveform, and LiveKit-audio-driven mouth motion.
- `vision.mode: turn_snapshot` attaches the latest subscribed camera or screen
  frame to an addressed completed turn. It is deliberately not continuous
  video analysis.
- The call surface shows setup, connecting, connected, permission failure,
  configuration failure, disconnected, and ended states.
- Recording is disabled for this slice.

## Limits

- Calls require a running named TypeScript worker and a reachable LiveKit
  deployment.
- Transcript persistence, generated avatars, continuous video analysis, and
  acoustic wake-name detection are outside this contract.
