---
name: file-change-listener
description: "Codex PostToolUse hook that summarizes tracked project file changes into compact bubble messages."
metadata: { "codex": { "events": ["PostToolUse"], "statusMessage": "Summarize tracked file update" } }
---

# File Change Listener Hook

Summarizes tracked project file edits with the local Codex CLI, then publishes
compact `file.change.summary` hook telemetry after write-capable tools modify
tracked project files.

Tracked files include progress/goals files, ticket files, selected docs, evals,
and skill memory files. The hook bounds file/tool snippets before summarization
and never publishes raw `file.changed` telemetry by default.

Codex summary controls:

1. `FARPLANE_CODEX_EXECUTABLE`, default `codex`.
2. `FARPLANE_FILE_CHANGE_SUMMARY_MODEL`, default `gpt-5.4-mini`.
3. `FARPLANE_FILE_CHANGE_SUMMARY_OSS=1` with optional
   `FARPLANE_FILE_CHANGE_SUMMARY_LOCAL_PROVIDER=ollama|lmstudio`.
4. `FARPLANE_FILE_CHANGE_SUMMARY_TIMEOUT_MS`, default `45000`.
5. `FARPLANE_FILE_CHANGE_SUMMARY_FALLBACK=1` to allow the old heuristic message
   when local Codex summarization fails.

Watched path precedence:

1. `FARPLANE_FILE_CHANGE_PATTERNS`, separated by commas or newlines.
2. Project config at `.farplane/hooks/config.json`.
3. `farplane/manifest.json` tracked files.
4. Built-in progress/docs/ticket defaults.

Patterns are project-relative globs such as `progress.md`, `docs/**/*.md`, and
`tickets/*/progress.md`.

Failed telemetry publishes are queued under `.farplane/hooks/outbox.jsonl` and
replayed by later hook runs.
