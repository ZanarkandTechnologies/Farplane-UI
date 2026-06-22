---
name: skill-invocation-listener
description: "Codex PostToolUse hook that logs successful SKILL.md reads as skill invocations."
metadata: { "codex": { "events": ["PostToolUse"], "statusMessage": "Read skill MD" } }
---

# Skill Invocation Listener Hook

Logs successful reads of `*/SKILL.md` as unified hook telemetry in Farplane.

The hook is deterministic and diagnostics-only:

- derives the skill name from the parent directory of the `SKILL.md` path
- posts compact path metadata to `/telemetry/hooks`
- does not store raw hook payloads, command output, or transcript text
- queues failed telemetry publishes under `.farplane/hooks/outbox.jsonl` when a
  project path is available
- exits successfully when no skill file is found or when the endpoint is missing

Install with:

```bash
npm run hooks:install
```

Then review and trust the hook in Codex with `/hooks`.
