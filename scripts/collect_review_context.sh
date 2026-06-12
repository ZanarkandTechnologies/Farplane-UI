#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
OUTPUT="${1:-}"
CHECK_LOG_DIR="${2:-}"
DIFF_LINES="${FARPLANE_REVIEW_DIFF_LINES:-1600}"
UNTRACKED_LINES="${FARPLANE_REVIEW_UNTRACKED_LINES:-400}"
INCLUDE_UNTRACKED="${FARPLANE_REVIEW_INCLUDE_UNTRACKED:-0}"

if [ -z "$OUTPUT" ]; then
  echo "Usage: scripts/collect_review_context.sh <output.md> [check-log-dir]" >&2
  exit 2
fi

mkdir -p "$(dirname "$OUTPUT")"

current_branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
upstream="$(git -C "$ROOT" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
base_ref=""
if [ -n "$upstream" ]; then
  base_ref="$(git -C "$ROOT" merge-base HEAD "$upstream" 2>/dev/null || true)"
fi
if [ -z "$base_ref" ]; then
  base_ref="$(git -C "$ROOT" rev-list --max-parents=0 HEAD | tail -n 1)"
fi

write_command_block() {
  local title="$1"
  shift
  {
    echo
    echo "## $title"
    echo
    echo '```text'
    (cd "$ROOT" && "$@") || true
    echo '```'
  } >>"$OUTPUT"
}

truncate_file_to_block() {
  local title="$1"
  local file="$2"
  local lines="${3:-120}"
  [ -f "$file" ] || return 0
  {
    echo
    echo "### $title"
    echo
    echo '```text'
    sed -n "1,${lines}p" "$file"
    echo '```'
  } >>"$OUTPUT"
}

is_review_text_file() {
  case "$1" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.md|*.sh|*.bash|*.zsh|*.css|*.scss|*.sass|*.html|*.toml|*.yaml|*.yml)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

cat >"$OUTPUT" <<EOF
---
generated: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
branch: "$current_branch"
upstream: "$upstream"
base_ref: "$base_ref"
---

# Farplane Review Context

This packet is generated for a Codex reviewer agent. Deterministic check output
comes first; reviewer judgment should explain issues in relation to these facts
and the diff.

EOF

write_command_block "Git Status" git status --short --branch
write_command_block "Commits Since Base" git log --oneline --decorate --no-merges "${base_ref}..HEAD"
write_command_block "Changed Files Since Base" git diff --name-status "$base_ref"...HEAD
write_command_block "Diff Stat Since Base" git diff --stat "$base_ref"...HEAD

if [ -n "$CHECK_LOG_DIR" ] && [ -d "$CHECK_LOG_DIR" ]; then
  {
    echo
    echo "## Deterministic Check Logs"
  } >>"$OUTPUT"
  while IFS= read -r -d '' log_file; do
    truncate_file_to_block "$(basename "$log_file")" "$log_file" 160
  done < <(find "$CHECK_LOG_DIR" -maxdepth 1 -type f -name '*.log' -print0 | sort -z)
fi

write_command_block "Diff Since Base (truncated)" bash -lc "git diff --no-ext-diff --unified=80 '$base_ref'...HEAD | sed -n '1,${DIFF_LINES}p'"

if ! git -C "$ROOT" diff --quiet; then
  write_command_block "Uncommitted Diff (truncated)" bash -lc "git diff --no-ext-diff --unified=80 | sed -n '1,${DIFF_LINES}p'"
fi

if ! git -C "$ROOT" diff --cached --quiet; then
  write_command_block "Staged Diff (truncated)" bash -lc "git diff --cached --no-ext-diff --unified=80 | sed -n '1,${DIFF_LINES}p'"
fi

untracked_files="$(git -C "$ROOT" ls-files --others --exclude-standard)"
if [ -n "$untracked_files" ]; then
  {
    echo
    echo "## Untracked Files"
    echo
    echo '```text'
    printf '%s\n' "$untracked_files"
    echo '```'
  } >>"$OUTPUT"

  if [ "$INCLUDE_UNTRACKED" = "1" ]; then
    {
      echo
      echo "## Untracked Text File Contents (truncated)"
    } >>"$OUTPUT"
    while IFS= read -r path; do
      [ -n "$path" ] || continue
      is_review_text_file "$path" || continue
      [ -f "$ROOT/$path" ] || continue
      {
        echo
        echo "### $path"
        echo
        echo '```text'
        sed -n "1,${UNTRACKED_LINES}p" "$ROOT/$path"
        echo '```'
      } >>"$OUTPUT"
    done <<<"$untracked_files"
  else
    {
      echo
      echo "Untracked file contents omitted. Set \`FARPLANE_REVIEW_INCLUDE_UNTRACKED=1\` only when those files are intentional review inputs."
    } >>"$OUTPUT"
  fi
fi
