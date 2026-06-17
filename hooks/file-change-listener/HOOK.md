---
name: file-change-listener
description: "Codex PostToolUse hook that emits compact bubble messages for tracked project file changes."
metadata: { "codex": { "events": ["PostToolUse"], "statusMessage": "Tracked file update" } }
---

# File Change Listener Hook

Publishes compact `file.changed` hook telemetry after write-capable tools modify
tracked project files.

Tracked files include progress/goals files, ticket files, selected docs, evals,
and skill memory files. The hook emits capped deterministic summaries and never
blocks agent work on publish failure.

Override watched paths with `FARPLANE_FILE_CHANGE_PATTERNS`, separated by commas
or newlines. Patterns are project-relative globs such as `progress.md`,
`docs/**/*.md`, and `tickets/*/progress.md`.
