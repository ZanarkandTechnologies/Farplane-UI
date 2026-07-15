---
ticket_id: TASK-0051
title: Add Farplane Radio office soundtrack
phase: review
status: review
owner: Farplane UI
priority: medium
depends_on: []
blocked_by: []
ready: true
approval_required: false
requires_qa: true
requires_demo: false
created_at: 2026-07-14T00:00:00Z
updated_at: 2026-07-14T02:52:05+08:00
next_action: Complete independent review against the refreshed final-media proof.
last_verification: 2026-07-14T02:52:05+08:00
---

# TASK-0051: Add Farplane Radio office soundtrack

## Summary

Generate a coherent ten-track instrumental office-lofi collection through the
repo-owned ElevenLabs skill and expose it through one compact player shared by
the standard and office3d renderers. Playback remains user-initiated, advances
continuously, and wraps from the final track to the first.

## Scope

- In: ten generated MP3s, provenance manifest, repeatable generation script,
  shared soundtrack module, compact shell player, previous/next, volume/mute,
  error state, automatic wrap, unit tests, and browser proof.
- Out: runtime music generation, user playlists, provider credential UI,
  cross-device playback sync, audio-reactive office animation, and crossfade.

## Delta

- Before: Farplane has no audio subsystem or background player.
- After: both renderers expose Farplane Radio and continuously play the curated
  ten-track collection after one explicit user play action.
- Tradeoff: v1 uses sequential track changes rather than overlapping crossfade.

## Change Plan

1. Generate one-minute `music_v2` instrumental tracks through Doppler-injected
   `ELEVENLABS_API_KEY`; store prompts and provider metadata in the asset manifest.
2. Add a module-local playlist contract, playback reducer/helpers, React audio
   lifecycle, and compact accessible controls.
3. Mount the player once in `FarplaneShell` so renderer changes do not duplicate
   audio ownership.
4. Prove playlist wrapping with tests and inspect the rendered `/office` player
   at desktop and narrow viewport sizes.

## Done

- Ten valid MP3 files and one provenance manifest exist.
- Play is user-triggered; pause, previous, next, mute, and volume work.
- `ended` advances to the next track and track ten wraps to track one.
- Player uses existing theme tokens, remains above the office canvas, and does
  not obscure primary controls at desktop or narrow widths.
- Focused tests, UI build, browser screenshot, console check, guideline audit,
  and independent review are recorded.

## Done / Proof

- Final media: `ui/public/audio/farplane-radio/manifest.json` records ten unique
  SHA-256 hashes, generation timestamps, prompts, model, terms, and normalization.
- Audio checks: `artifacts/audio-qa.md` records duration, loudness, true peak,
  loudness range, and long-silence scans for every track.
- Player behavior: `artifacts/browser-qa/visual-qa.md` proves user-initiated play,
  all ten range responses, natural end continuation, 10 -> 1 wrap, zero-volume
  unmute recovery, no page errors, and desktop/mobile layout.
- Automated checks: soundtrack/shell tests pass (10 tests); production UI build passes.
- Residual subjective gate: agent runtime cannot hear audio, so human taste approval
  remains an explicit operator listen rather than a fabricated acceptance claim.

## QA Strategy

- Unit-test index wrapping, time formatting, and player state transitions.
- Build the UI and run the soundtrack tests.
- Open `/office`; capture paused and playing states; verify controls through DOM
  and audio element state; inspect console/page errors.
- Check a 375px viewport for clipping and control overlap.
- Review against `docs/TASTE.md`, current Web Interface Guidelines, and the
  frontend-craft copy/accessibility checklist.

## Agent Contract

- Open: `npm run ui`, then `/office`.
- Inspect: `[data-testid="farplane-radio"]`, its buttons, slider, track label,
  and descendant `audio` element.
- Key screens/states: compact paused player, playing player, muted player,
  narrow viewport, and unavailable-track error.
- Design baseline: dense restrained HUD using existing card/border/primary tokens;
  controls are the hierarchy and explanatory prose is absent.
- QA cookbook: `qa/cookbook/office.md`.
- Taste refs: `docs/TASTE.md`.
- Expected artifacts: desktop and narrow screenshots, console/errors log, test output.

## Links

- artifacts: `tickets/TASK-0051/artifacts/`
- refs: `.agents/skills/music/SKILL.md`, `ui/src/shell/README.md`
