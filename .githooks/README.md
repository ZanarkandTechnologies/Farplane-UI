# Git Hooks

These hooks are optional. They provide a visible local quality-gate path without
silently changing git config.

## Recommended Default

Use `pre-push` as the heavier local gate:

- large-file scan
- current required build gates
- advisory lint/test/typecheck checks until known debt is cleared

Use `pre-commit` only if you want a small fast check before each commit.

## Activate

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-push
```

Optional pre-commit:

```bash
chmod +x .githooks/pre-commit
```

## Notes

- The hooks call repo-local scripts:
  - `scripts/pre_push_check.sh`
  - `scripts/pre_commit_check.sh`
- Keep policy in the scripts, not in the hook wrappers.
- Set `PRE_PUSH_STRICT_ADVISORY=1` once lint/test/typecheck are ready to block.
- Set `PRE_PUSH_STRICT_LARGE_FILES=1` once the current oversized-file backlog is
  cleaned up.
