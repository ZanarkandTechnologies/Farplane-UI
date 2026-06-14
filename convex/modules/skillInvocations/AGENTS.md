# Skill Invocations Convex Module Contract

## Boundaries

- Own append-only skill invocation events from Codex tool hooks.
- Own dashboard query summaries for skill usage counts and recent reads.
- Do not store raw hook payloads, transcripts, command output, or secrets.

## Rules

- A `SKILL.md` read is the deterministic proxy for a skill invocation.
- `stepKey` de-duplicates repeated hook posts for the same tool event.
- Keep ingestion tolerant of missing session metadata.

## Test

- `npm run test:once -- convex/modules/skillInvocations`
- `npx tsc -p convex/tsconfig.json --noEmit`
