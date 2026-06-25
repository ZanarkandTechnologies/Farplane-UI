# Hook Telemetry

Raw hook telemetry operator surface for unified Codex hook events.

- `RawTelemetryPanel` opens from the office launcher.
- The panel reads `hookTelemetryEvents` through Convex and renders event rows, distributions, and hook setup guidance.
- The file-change hook is configured by project-local `.farplane/hooks/config.json`; the Hooks tab can save watched patterns and ask the local Vite bridge to run the installer.
- Tracked file edits emit `file.change.summary` after local Codex summarization; raw `file.changed` telemetry is intentionally skipped by default.
- Thread create/fork hooks emit `thread.created` and `thread.forked` metadata that remains available in the raw event rows and distributions. They do not store prompts, transcripts, or full thread bodies.
