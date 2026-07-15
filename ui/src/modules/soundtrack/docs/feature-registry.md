# Soundtrack Feature Registry

## Farplane Radio

- Owner: `ui/src/modules/soundtrack`
- Entry: shared `FarplaneShell` HUD
- Assets: `ui/public/audio/farplane-radio`
- States: paused, playing, muted, track unavailable
- Controls: previous, play/pause, next, mute, volume
- Playback contract: explicit first play, sequential advance, final-to-first wrap
- Deferred: runtime generation, user playlists, crossfade, persisted preferences
