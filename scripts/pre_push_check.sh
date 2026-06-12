#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"

WARN_THRESHOLD="${PRE_PUSH_WARN_LINES:-500}"
BLOCK_THRESHOLD="${PRE_PUSH_BLOCK_LINES:-1000}"
STRICT_LARGE_FILES="${PRE_PUSH_STRICT_LARGE_FILES:-0}"
STRICT_ADVISORY="${PRE_PUSH_STRICT_ADVISORY:-0}"

warn_tmp="$(mktemp)"
block_tmp="$(mktemp)"
reviews_root="$ROOT/.farplane/reviews"
review_dir="${FARPLANE_PRE_PUSH_REVIEW_DIR:-$reviews_root/pre-push-latest}"
case "$review_dir" in
  /*) ;;
  *) review_dir="$ROOT/$review_dir" ;;
esac
mkdir -p "$reviews_root" "$(dirname "$review_dir")"
reviews_root="$(cd "$reviews_root" && pwd -P)"
review_dir="$(cd "$(dirname "$review_dir")" && pwd -P)/$(basename "$review_dir")"
case "$review_dir/" in
  "$reviews_root"/*) ;;
  *)
    echo "Refuse unsafe FARPLANE_PRE_PUSH_REVIEW_DIR outside $reviews_root: $review_dir" >&2
    exit 2
    ;;
esac
log_dir="$review_dir/checks"
cleanup() {
  rm -f "$warn_tmp" "$block_tmp"
}
trap cleanup EXIT

rm -rf "$review_dir"
mkdir -p "$log_dir"

is_excluded_path() {
  case "$1" in
    .git/*|.farplane/*|.next/*|dist/*|build/*|coverage/*|out/*|tmp/*|temp/*|vendor/*|third_party/*|node_modules/*|.turbo/*|.cache/*|.desloppify/*|generated/*|__generated__/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_source_file() {
  case "$1" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.py|*.go|*.rs|*.java|*.kt|*.swift|*.rb|*.php|*.sh|*.bash|*.zsh|*.css|*.scss|*.sass|*.vue|*.svelte|*.c|*.cc|*.cpp|*.h|*.hpp|*.cs)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

collect_source_file_sizes() {
  while IFS= read -r -d '' path; do
    is_excluded_path "$path" && continue
    is_source_file "$path" || continue

    lines="$(wc -l <"$ROOT/$path" | tr -d ' ')"
    if [ "$lines" -ge "$BLOCK_THRESHOLD" ]; then
      printf '%s\t%s\n' "$lines" "$path" >>"$block_tmp"
    elif [ "$lines" -ge "$WARN_THRESHOLD" ]; then
      printf '%s\t%s\n' "$lines" "$path" >>"$warn_tmp"
    fi
  done < <(git -C "$ROOT" ls-files -z)
}

print_ranked_list() {
  local heading="$1"
  local file="$2"

  [ -s "$file" ] || return 0

  echo "$heading"
  sort -t "$(printf '\t')" -k1,1nr -k2,2 "$file" | while IFS=$'\t' read -r lines path; do
    printf '  - %s lines :: %s\n' "$lines" "$path"
  done
}

run_required() {
  local label="$1"
  shift
  local log_file="$log_dir/${label//[^A-Za-z0-9_.-]/_}.log"
  echo "Run required: $label"
  if (cd "$ROOT" && "$@") >"$log_file" 2>&1; then
    echo "Pass required: $label"
    return 0
  fi
  echo "Fail required: $label"
  tail -n 120 "$log_file"
  return 1
}

run_advisory() {
  local label="$1"
  shift
  local log_file="$log_dir/${label//[^A-Za-z0-9_.-]/_}.log"
  echo "Run advisory: $label"
  if (cd "$ROOT" && "$@") >"$log_file" 2>&1; then
    echo "Pass advisory: $label"
    return 0
  fi
  if [ "$STRICT_ADVISORY" = "1" ]; then
    echo "Fail advisory check because PRE_PUSH_STRICT_ADVISORY=1: $label"
    tail -n 120 "$log_file"
    return 1
  fi
  echo "Warn only: $label failed. Set PRE_PUSH_STRICT_ADVISORY=1 after cleanup to make this blocking."
  tail -n 80 "$log_file"
  return 0
}

collect_source_file_sizes

run_required "code smell check" npm run quality:smells

print_ranked_list "Warn: large tracked source files detected" "$warn_tmp"

if [ -s "$block_tmp" ]; then
  print_ranked_list "Warn: oversized tracked source files detected" "$block_tmp"
  if [ "$STRICT_LARGE_FILES" = "1" ]; then
    echo "Fail oversized files because PRE_PUSH_STRICT_LARGE_FILES=1."
    exit 1
  fi
  echo "Warn only: set PRE_PUSH_STRICT_LARGE_FILES=1 after refactoring existing oversized files."
fi

run_required "root build/typecheck" npm run build
run_required "UI production build" npm run ui:build

run_advisory "lint" npm run lint
run_advisory "tests" npm run test:once
run_advisory "full typecheck" npm run typecheck

if [ "${STRICT_AGENT_REVIEW:-0}" = "1" ]; then
  run_required "codex agent review" env FARPLANE_PRE_PUSH_REVIEW_DIR="$review_dir" npm run review:prepush
elif [ "${FARPLANE_AGENT_REVIEW:-0}" = "1" ]; then
  run_advisory "codex agent review" env FARPLANE_PRE_PUSH_REVIEW_DIR="$review_dir" npm run review:prepush
else
  echo "Skip Codex agent review. Set FARPLANE_AGENT_REVIEW=1 for advisory review or STRICT_AGENT_REVIEW=1 to require it."
fi

echo "Pre-push checks completed."
