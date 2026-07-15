# Soundtrack Module Contract

## Rules

- Keep one audio element and playback owner mounted through the shared shell.
- Playback must begin from an explicit operator action; never force audible autoplay.
- Playlist wrapping and track selection remain pure, unit-tested helpers.
- Generated-track provenance belongs beside the audio assets in `manifest.json`.
- Do not persist player preferences through browser storage.

## Test

- `npm run test:once -- ui/src/modules/soundtrack`
- Browser QA on `/office` at desktop and narrow widths.
