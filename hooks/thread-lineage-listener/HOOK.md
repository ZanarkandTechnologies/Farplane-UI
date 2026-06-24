---
name: thread-lineage-listener
description: "Codex PostToolUse hook that records create_thread and fork_thread lineage edges."
metadata: { "codex": { "events": ["PostToolUse"], "statusMessage": "Track thread lineage" } }
---

# Thread Lineage Listener Hook

Records compact Codex thread lineage events after successful thread-management
tool calls.

The hook emits:

- `thread.created` for `create_thread`
- `thread.forked` for `fork_thread`

It persists only identifiers and labels needed for graphing lineage:
parent thread/session, child thread or pending worktree id, title, cwd/project
path, source tool, turn id, and event key. It does not store prompts,
transcripts, raw tool output, or thread bodies.

Failed telemetry publishes are queued under `.farplane/hooks/outbox.jsonl` and
replayed by later hook runs.
