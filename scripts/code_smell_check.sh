#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
MODE="${1:-full}"
WARN_LINES="${CODE_SMELL_WARN_LINES:-500}"
BLOCK_NEW_LINES="${CODE_SMELL_BLOCK_NEW_LINES:-500}"
BLOCK_LINES="${CODE_SMELL_BLOCK_LINES:-1000}"
STRICT_EXISTING_LARGE_FILES="${CODE_SMELL_STRICT_EXISTING_LARGE_FILES:-0}"

is_excluded_path() {
  case "$1" in
    .git/*|.farplane/*|dist/*|build/*|coverage/*|out/*|tmp/*|temp/*|vendor/*|third_party/*|node_modules/*|.turbo/*|.cache/*|generated/*|__generated__/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_source_file() {
  case "$1" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.py|*.sh|*.bash|*.zsh|*.css|*.scss|*.sass)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

tracked_files() {
  if [ "$MODE" = "staged" ]; then
    git -C "$ROOT" diff --cached --name-only --diff-filter=ACMR
  else
    git -C "$ROOT" ls-files
  fi
}

failures=0
warnings=0

while IFS= read -r path; do
  [ -n "$path" ] || continue
  is_excluded_path "$path" && continue
  is_source_file "$path" || continue
  [ -f "$ROOT/$path" ] || continue

  lines="$(wc -l <"$ROOT/$path" | tr -d ' ')"
  status="$(git -C "$ROOT" status --short -- "$path" | awk '{print $1}' | head -1)"
  if [ "$status" = "A" ] && [ "$lines" -gt "$BLOCK_NEW_LINES" ]; then
    echo "Fail: new source file exceeds ${BLOCK_NEW_LINES} lines: ${lines} :: ${path}"
    failures=$((failures + 1))
  elif [ "$lines" -ge "$BLOCK_LINES" ]; then
    if [ "$STRICT_EXISTING_LARGE_FILES" = "1" ]; then
      echo "Fail: source file exceeds ${BLOCK_LINES} lines: ${lines} :: ${path}"
      failures=$((failures + 1))
    else
      echo "Warn: oversized existing source file (${lines} lines): ${path}"
      warnings=$((warnings + 1))
    fi
  elif [ "$lines" -ge "$WARN_LINES" ]; then
    echo "Warn: large source file (${lines} lines): ${path}"
    warnings=$((warnings + 1))
  fi
done < <(tracked_files)

legacy_imports="$(
  git -C "$ROOT" grep -n "modules/office/utils/object-footprints" -- \
    "ui/src" "cli" 2>/dev/null || true
)"
legacy_imports="$(
  printf '%s\n' "$legacy_imports" | grep -v "ui/src/modules/office/utils/object-footprints.ts" || true
)"
if [ -n "$legacy_imports" ]; then
  echo "Fail: office footprint imports must use office/systems/occupancy-system:"
  printf '%s\n' "$legacy_imports"
  failures=$((failures + 1))
fi

provider_collision_logic="$(
  git -C "$ROOT" grep -nE "countObjectFootprintCollisions|objectFootprintsCollide|isObjectFootprintInsideLayout" -- \
    "ui/src/providers" 2>/dev/null || true
)"
if [ -n "$provider_collision_logic" ]; then
  echo "Fail: provider code must consume office placement systems, not raw collision helpers:"
  printf '%s\n' "$provider_collision_logic"
  failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
  echo "Code smell check failed with ${failures} failure(s)."
  exit 1
fi

echo "Code smell check passed (${warnings} warning(s))."
