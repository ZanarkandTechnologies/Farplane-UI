---
ticket: TKT-025
status: active
created: 2026-06-14
---

# Progress

## 2026-06-14

- Started native Goal for skill invocation listener implementation.
- Loaded `goal-advisor`, ticket, project rules, Codex hook manual cache, and existing hook/backend/UI patterns.
- Missing optional references confirmed: `docs/specs/goal-loop-contract.md`, goal-loop templates, and `convex/_generated/ai/guidelines.md`.
- Moved ticket state toward `building`; implementation next.
- Added repo-owned `hooks/skill-invocation-listener` package with parser, publisher, runtime entrypoint, and focused fixtures.
- Added idempotent installer `scripts/install-skill-invocation-hook.mjs` plus `npm run hooks:install:skill-invocations`; installed repo-local `.codex/hooks.json`.
- Added Convex `skillInvocations` module, schema composition, dashboard query, and HTTP ingest route at `/skill-invocations/ingest`.
- Added office UI module and launcher entry for the Skill Invocations panel with range selection, count cards, recent rows, empty/loading/unavailable states.
- Ran focused tests, Convex typecheck, root build, UI production build, installer dry-run, hook smoke, and browser panel QA.
- QA report: `artifacts/qa/skill-invocations-qa.md`.
- After hook approval, ran live ingest smoke against dev Convex by reading real `advise` and `goal-advisor` `SKILL.md` files, then feeding equivalent `PostToolUse` payloads into the approved hook runner. Both logged successfully with `sessionId` and `turnId`; dashboard query returned `invocationCount: 2`. `manual-smoke` was the test `sessionId`.
- Hardened hook runner to fall back to repo `.env.local` for `CONVEX_SITE_URL` / `FARPLANE_CONVEX_SITE_URL` and optional `FARPLANE_TELEMETRY_TOKEN`, so the approved hook does not depend on Codex inheriting shell env.
