---
ticket: TKT-025
artifact_type: qa-report
created: 2026-06-14
status: passed-with-caveats
---

# Skill Invocation Listener QA

## Summary

The skill invocation listener slice is implemented across the Codex hook package, install helper, Convex ingest/query module, and office UI panel.

## Evidence

- Hook parser fixtures detect `*/SKILL.md`, derive the skill id from the parent directory, ignore non-skill paths, and avoid raw output/transcript fields.
- Convex unit coverage validates payload parsing and dashboard aggregation.
- UI unit coverage validates formatting helpers and the office registry route.
- Browser evidence captured the Skill Invocations panel empty state at `artifacts/qa/screenshots/skill-invocations-dialog.png`.
- Local hook installer wrote repo-local `.codex/hooks.json`; the file is gitignored by project policy.
- After operator approval, live smoke read the real `advise` and `goal-advisor` `SKILL.md` files, then fed equivalent `PostToolUse` payloads into the approved hook runner. Both logged to dev Convex with `sessionId` and `turnId` populated.
- Hook runner now falls back to repo `.env.local` for the Convex site URL when the Codex hook process does not inherit shell env.

## Commands

```bash
npm run test:once -- hooks/skill-invocation-listener convex/modules/skillInvocations ui/src/modules/skill-invocations ui/src/components/hud/office-panel-registry.test.ts ui/src/shell/shell-config.test.ts ui/src/store/app-store.test.ts
npx tsc -p convex/tsconfig.json --noEmit
npm run build
npm run ui:build
node scripts/install-skill-invocation-hook.mjs --json
printf '%s' '{"toolName":"Bash","toolInput":{"command":"sed -n 1,20p /Users/kenjipcx/.codex/skills/harness-advisor/SKILL.md"},"cwd":"/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI"}' | ./node_modules/.bin/tsx hooks/skill-invocation-listener/run.ts
npm run test:once -- hooks/skill-invocation-listener
```

## Results

- Focused Vitest: passed, 6 files and 21 tests.
- Convex typecheck: passed.
- Root TypeScript build: passed.
- UI production build: passed with existing large chunk warnings.
- Installer dry-run: passed.
- Hook smoke without endpoint env: exited zero and skipped network publish by design.
- Live hook smoke with `.env.local` fallback: dev dashboard query returned `invocationCount: 2`, `skillCount: 2`, `sourceToolCount: 1`. The `manual-smoke` value was a test `sessionId`, not a separate telemetry source.
- Post-fallback hook tests: passed, 1 file and 6 tests.

## Caveats

- `npm run --workspace @farplane/ui typecheck` still reports broad existing UI type debt outside this slice. One new local test typing issue found during that run was fixed.
- Headless browser QA recorded Three.js WebGL context errors from the office renderer. The panel itself rendered and was captured after hiding the boot overlay for the screenshot.
- Codex hook trust cannot be automated; the operator still needs to review and trust the changed hook via `/hooks`.
