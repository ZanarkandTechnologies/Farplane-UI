#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
CHECK_SCRIPT="$ROOT/scripts/pre_push_check.sh"

if [ -f "$CHECK_SCRIPT" ]; then
  bash "$CHECK_SCRIPT"
else
  echo "Skip pre-push checks: missing $CHECK_SCRIPT" >&2
fi
