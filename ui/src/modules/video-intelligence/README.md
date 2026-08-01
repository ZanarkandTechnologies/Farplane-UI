# Video Intelligence

Video Intelligence is Farplane's durable viewing memory for the YouTube
shortcut. The local bridge records a queue item immediately, turns completed
analysis into a cited dossier, attaches each reported event or claim to a
provisional story, and rebuilds the story comparison from every linked source.

The AI Office panel is read-only. Canonical state lives at
`$FARPLANE_STATE_DIR/video-intelligence/state.json`, falling back to
`$FARPLANE_HOME` and then `~/.farplane`.

## Workflow

1. Browse timeline-grouped Videos or event-date-grouped Stories.
2. Open a video dossier without leaving the panel.
3. Open a linked story to inspect reporting chronology, perspectives,
   shared/source-specific claims, related events, and timestamp evidence.
4. Use Back to return to the same tab, query, tag filter, and scroll context.

The information-flow section is read-only: source edges mean `contributes` and
story edges mean conservatively `related`. It never claims citation or
causality. Publisher scoring, tag rename/merge governance, editable graphs, and
cloud sync remain deferred.
