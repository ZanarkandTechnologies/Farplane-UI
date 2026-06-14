---
name: skill-invocation-listener
description: "Codex PostToolUse hook that logs successful SKILL.md reads as skill invocations."
metadata: { "codex": { "events": ["PostToolUse"], "statusMessage": "Read skill MD" } }
---

# Skill Invocation Listener Hook

Logs successful reads of `*/SKILL.md` as `skill_invoked` events in Farplane.

The hook is deterministic and diagnostics-only:

- derives the skill name from the parent directory of the `SKILL.md` path
- posts compact path metadata to `/skill-invocations/ingest`
- does not store raw hook payloads, command output, or transcript text
- exits successfully when no skill file is found or when the endpoint is missing

Install with:

```bash
node scripts/install-skill-invocation-hook.mjs --write
```

Then review and trust the hook in Codex with `/hooks`.
