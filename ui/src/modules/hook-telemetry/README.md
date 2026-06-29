# Hook Telemetry

Project Timeline operator surface for unified Codex hook events.

- `RawTelemetryPanel` opens from the office launcher but now behaves as the
  project Timeline cockpit: Events, Hooks, Programs, Raw, and Distribution.
- The panel reads `hookTelemetryEvents` through Convex and renders event rows,
  distributions, hook setup, recent hook previews, and non-executing Event
  Program routing previews.
- The file-change hook is configured by project-local
  `.farplane/hooks/config.json`; the Hooks tab can save watched patterns,
  toggle summary bubbles, and ask the local Vite bridge to run the installer.
- Tracked file edits emit typed `farplane.*` events when capture is enabled.
  Legacy `file.change.summary` bubbles are controlled by `summaryEnabled`.
- Event Programs are shown as routing previews only in this slice. Program
  execution remains owned by mining runs and future event-program config.
- Thread create/fork hooks emit `thread.created` and `thread.forked` metadata
  that remains available in event rows and distributions. They do not store
  prompts, transcripts, or full thread bodies.
