---
kind: project-evals
status: draft
project: Farplane UI
created_at: 2026-06-17
updated_at: 2026-06-17
framework_template_version: "0.1.0"
owner: harness
---

# Project Evals

## Standard Verification

```bash
bash scripts/pre_push_check.sh
npm run test:once
npm run ui:build
```

Use the narrower project-specific validator, test, build, or QA commands
recorded in `PROJECT_RULES.md` when they better match the touched surface.

## Eval Candidates

- Office route loads and exposes the expected module entrypoints.
- Runtime adapter smoke: Codex default mode plus OpenClaw optional mode.
- Pre-push review packet generation and advisory reviewer output.
