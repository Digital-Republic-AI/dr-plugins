#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook: injects the plugin's SDD operating principles (PRINCIPLES.md, shipped with
# the plugin) into the session context -- but only when the current project actually uses spek
# (a .spek/ directory exists), so unrelated projects are not lectured about SDD.
#
# This is distinct from inject-constitution.sh: the constitution is the USER's per-project
# principles; PRINCIPLES.md is the plugin's own methodology, identical everywhere.

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
if [[ ! -d "${PROJECT_ROOT}/.spek" ]]; then
  exit 0
fi

# PRINCIPLES.md lives next to the hooks that consume it (hooks/), resolved
# relative to this script's own location (hooks/scripts/).
PRINCIPLES_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/PRINCIPLES.md"

if [[ -f "${PRINCIPLES_PATH}" ]]; then
  cat <<EOF
## SDD operating principles (auto-loaded by the spek plugin)

$(cat "${PRINCIPLES_PATH}")
EOF
fi

exit 0
