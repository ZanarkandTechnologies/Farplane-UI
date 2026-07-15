# Soundtrack QA

1. Start `npm run ui` and open `/office`.
2. Locate `[data-testid="farplane-radio"]` at the bottom center.
3. Press Play and confirm the descendant audio element is unpaused with volume `0.28`.
4. Press Next and confirm the title and `audio.src` advance while playback continues.
5. Press Previous, mute/unmute, and adjust volume.
6. Dispatch `ended` for track ten and confirm the player returns to track one.
7. Repeat at a 375 px viewport; controls must remain visible without horizontal overflow.
8. Capture screenshots plus console and page-error output.
