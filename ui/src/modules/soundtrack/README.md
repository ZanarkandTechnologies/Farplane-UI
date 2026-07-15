# Soundtrack

The soundtrack module owns Farplane Radio: a curated instrumental playlist and
one compact background player shared by the standard and office3d renderers.

```text
playlist + operator playback intent -> HTMLAudioElement -> continuous wrapped playback
```

Audio files and generation provenance live under
`ui/public/audio/farplane-radio/`. The shell owns placement; this module owns
all playback behavior and controls.
