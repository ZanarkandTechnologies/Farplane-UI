#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/home/kenjipcx/Zanarkand/Farplane"

if command -v farplane >/dev/null 2>&1; then
  exec farplane "$@"
fi

if [[ -n "${HOME:-}" && -d "${HOME}/.local/share/fnm/node-versions" ]]; then
  shopt -s nullglob
  for farplane_candidate in "${HOME}/.local/share/fnm/node-versions"/*/installation/bin/farplane; do
    node_candidate="${farplane_candidate%/farplane}/node"
    if [[ -x "${farplane_candidate}" && -x "${node_candidate}" ]]; then
      exec "${node_candidate}" "${farplane_candidate}" "$@"
    fi
  done
  shopt -u nullglob
fi

if command -v npm >/dev/null 2>&1; then
  exec npm --prefix "${REPO_ROOT}" run shell -- "$@"
fi

if command -v node >/dev/null 2>&1 && [[ -f "${REPO_ROOT}/bin/farplane.js" ]]; then
  exec node "${REPO_ROOT}/bin/farplane.js" "$@"
fi

echo "farplane_cli_unavailable: install farplane globally or ensure npm/node are available" >&2
exit 127
