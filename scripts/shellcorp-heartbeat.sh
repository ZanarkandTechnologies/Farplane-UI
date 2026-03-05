#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/home/kenjipcx/Zanarkand/ShellCorp"

if command -v shellcorp >/dev/null 2>&1; then
  exec shellcorp "$@"
fi

if [[ -n "${HOME:-}" && -d "${HOME}/.local/share/fnm/node-versions" ]]; then
  shopt -s nullglob
  for shellcorp_candidate in "${HOME}/.local/share/fnm/node-versions"/*/installation/bin/shellcorp; do
    node_candidate="${shellcorp_candidate%/shellcorp}/node"
    if [[ -x "${shellcorp_candidate}" && -x "${node_candidate}" ]]; then
      exec "${node_candidate}" "${shellcorp_candidate}" "$@"
    fi
  done
  shopt -u nullglob
fi

if command -v npm >/dev/null 2>&1; then
  exec npm --prefix "${REPO_ROOT}" run shell -- "$@"
fi

if command -v node >/dev/null 2>&1 && [[ -f "${REPO_ROOT}/bin/shellcorp.js" ]]; then
  exec node "${REPO_ROOT}/bin/shellcorp.js" "$@"
fi

echo "shellcorp_cli_unavailable: install shellcorp globally or ensure npm/node are available" >&2
exit 127
