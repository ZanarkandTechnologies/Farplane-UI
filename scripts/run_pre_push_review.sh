#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
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

mkdir -p "$review_dir/checks"

cd "$ROOT"
bash scripts/collect_review_context.sh "$review_dir/context.md" "$review_dir/checks"
npm run review:agent -- "$review_dir/context.md" "$review_dir/review.json"
