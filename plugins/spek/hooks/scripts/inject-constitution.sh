#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook: injects the project constitution content (if it exists) into the session context.
# Receives the hook payload via stdin (JSON); we don't need any of its fields here, only the process cwd.

CONSTITUTION_PATH="${CLAUDE_PROJECT_DIR:-$(pwd)}/.spek/constitution.md"

if [[ -f "${CONSTITUTION_PATH}" ]]; then
  CONTENT="$(cat "${CONSTITUTION_PATH}")"
  # SessionStart hooks do not block; stdout is appended to the session context as system text.
  cat <<EOF
## Project constitution (auto-loaded by the spek plugin)

${CONTENT}

All /spek:* commands and subagents of this plugin must respect the principles above.
EOF
else
  # No constitution yet -- do not block the session, just inject nothing.
  exit 0
fi
