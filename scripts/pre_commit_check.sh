#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"

echo "Run pre-commit smell check."
(cd "$ROOT" && npm run quality:smells:staged)
