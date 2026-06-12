---
title: Codex Review Agent Loop
status: active
owner: Zanarkand Technologies
updated: 2026-06-12
---

# Codex Review Agent Loop

Farplane UI uses deterministic checks first and a Codex SDK reviewer second.
The reviewer is a second pair of eyes for drift, modularity, risky commits, and
missed proof. It runs during local pre-push by default as an advisory check.

## Commands

- `npm run quality:smells`: deterministic smell and ownership checks.
- `npm run review:context`: writes `.farplane/reviews/latest/context.md`.
- `npm run review:agent`: reviews `.farplane/reviews/latest/context.md`.
- `npm run review:prepush`: collects pre-push context and runs the reviewer.
- `bash scripts/pre_push_check.sh`: runs deterministic gates, then advisory
  agent review.

## Environment

- `FARPLANE_SKIP_AGENT_REVIEW=1`: skip the advisory agent review during pre-push.
- `STRICT_AGENT_REVIEW=1`: run required agent review during pre-push.
- `CODEX_REVIEW_MODEL=<model>`: override the Codex SDK model.
- `CODEX_REVIEW_TIMEOUT_MS=<ms>`: abort the review turn after a timeout.
- `FARPLANE_REVIEW_DIFF_LINES=<n>`: change the diff line cap in review context.
- `FARPLANE_REVIEW_UNTRACKED_LINES=<n>`: change the per-file cap for untracked
  text files in review context.
- `FARPLANE_REVIEW_INCLUDE_UNTRACKED=1`: include untracked text file contents in
  the review prompt. Leave this off unless those files are intentional review
  inputs.
- `FARPLANE_PRE_PUSH_REVIEW_DIR=<path>`: write pre-push artifacts under a custom
  path. The path must resolve under `.farplane/reviews/`.

## Output

Pre-push writes artifacts to `.farplane/reviews/pre-push-latest/`:

- `context.md`: deterministic checks, changed files, commits, and truncated diffs.
- `review.prompt.md`: exact prompt sent to Codex.
- `review.json`: structured review output.
- `review.md`: human-readable summary.

`.farplane/reviews/` is ignored because it can contain local diffs, private
paths, and check logs. Untracked file names are listed, but untracked file
contents are omitted unless explicitly enabled.

The reviewer process uses an allowlisted environment instead of inheriting the
full shell environment.
