#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook (matcher: Write|Edit|MultiEdit): blocks writes to advanced-phase SDD artifacts
# (plan.md, tasks.md) when the previous phase's prerequisite has not been satisfied, and blocks
# writes to baseline.md once spec.md exists (baseline immutability).
#
# Reads the hook JSON payload from stdin and extracts file_path from tool_input.

# jq is a hard dependency for parsing the hook payload and is documented as a
# prerequisite in the README. If it is missing, degrade to a silent no-op
# rather than failing noisily on every tool call.
command -v jq >/dev/null 2>&1 || exit 0

# Ordering rules are shared with the sdd-templates scaffold script (plugin-root scripts/lib/).
# shellcheck source=scripts/lib/prereq.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/scripts/lib/prereq.sh"

INPUT_JSON="$(cat)"
# An unparseable payload is not a reason to block or to spam stderr: degrade to a no-op.
jq -e . >/dev/null 2>&1 <<<"${INPUT_JSON}" || exit 0
FILE_PATH="$(jq -r '.tool_input.file_path // empty' <<<"${INPUT_JSON}")"
[[ -n "${FILE_PATH}" ]] || exit 0

# Normalize relative paths against the session cwd (provided in the hook payload,
# falling back to the hook's own cwd). Without this, a relative
# ".spek/specs/NNN-slug/plan.md" would not match the filter below and would
# silently bypass the gate.
if [[ "${FILE_PATH}" != /* ]]; then
  CWD="$(jq -r '.cwd // empty' <<<"${INPUT_JSON}")"
  FILE_PATH="${CWD:-${PWD}}/${FILE_PATH}"
fi

# We only care about writes inside .spek/specs/<feature>/
if [[ "${FILE_PATH}" != *"/.spek/specs/"*"/"* ]]; then
  exit 0
fi

FEATURE_DIR="$(dirname "${FILE_PATH}")"
FILE_NAME="$(basename "${FILE_PATH}")"

# No managed-dir guard is needed here: the .spek/specs/ path is namespaced to this
# plugin, so anything under it is spek-owned by definition and every feature dir
# is gated -- including hand-created ones.

# Exit code 2 in PreToolUse blocks the tool and returns stderr as feedback to the model.
artifact_write_blocked "${FEATURE_DIR}" "${FILE_NAME}" || exit 2

exit 0
