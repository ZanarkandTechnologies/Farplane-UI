# Soundtrack QA

1. Start `npm run ui` and open `/office`.
2. Locate `[data-testid="office-radio-hud-trigger"]` in the top-right HUD rail;
   confirm the removed `[data-testid="farplane-radio"]` bottom player count is `0`.
3. Hover the trigger, move the pointer into
   `[data-testid="office-radio-hud-card"]`, and confirm the card remains open.
4. Focus the trigger with the keyboard and confirm the card exposes Previous,
   Play/Pause, Next, Mute, and volume controls; press Escape to dismiss it.
5. Press Play and confirm the provider-owned audio element is unpaused with
   volume `0.28`.
6. Press Next and confirm the title and `audio.src` advance while playback
   continues. Press Previous, mute/unmute, and adjust volume.
7. Dispatch `ended` for track ten and confirm the player returns to track one.
8. Repeat at a 375px viewport; the HUD rail and 320px player card must remain
   visible without horizontal overflow.
9. Enable reduced motion and confirm the radio equalizer/status indicator does
   not animate.
10. Capture closed-rail and open-card screenshots plus console and page-error
    output.
