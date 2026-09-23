#!/usr/bin/env bash
set -euo pipefail

# new-feature.sh - Deterministic feature bootstrap helper for /spek:specify.
#
# Resolves the next sequential feature number under .spek/specs/, creates the
# feature directory, and prints a single-line JSON object describing the
# result. All numbering/path logic lives here so the LLM driving /spek:specify
# never has to compute it itself.
#
# Usage:
#   new-feature.sh <slug> [--json]
#
# Arguments:
#   <slug>   Kebab-case feature slug (lowercase letters, digits, hyphens).
#
# Options:
#   --json   Print the result as JSON (default behavior; flag is accepted
#            for explicitness/compatibility and has no additional effect).
#   -h, --help   Show this help message and exit.
#
# Output (stdout, single line JSON):
#   {"feature":"NNN-<slug>","number":"NNN","slug":"<slug>","dir":"<absolute path>","branch":"NNN-<slug>"}
#
# If a directory for the same slug already exists under .spek/specs/ (any
# "*-<slug>" match), no new directory is created: the existing feature's
# JSON is printed with an additional "existing":true field, and the script
# exits 0.
#
# Environment:
#   CLAUDE_PROJECT_DIR   Project root. Defaults to the current working
#                        directory when unset.
#
# Requirements:
#   jq must be available on PATH (used to emit correctly escaped JSON).

SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} <slug> [--json]

Create the next sequentially-numbered feature directory under .spek/specs/.

Arguments:
  <slug>       Kebab-case feature slug (lowercase letters, digits, hyphens).

Options:
  --json       Print the result as JSON (default; accepted for explicitness).
  -h, --help   Show this help message and exit.

Output:
  A single-line JSON object on stdout:
  {"feature":"NNN-<slug>","number":"NNN","slug":"<slug>","dir":"<absolute path>","branch":"NNN-<slug>"}

  If a feature directory for the same slug already exists, its JSON is
  printed instead (with an added "existing":true field) and no new
  directory is created.
EOF
}

# --- Dependency check -----------------------------------------------------

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: 'jq' is required by ${SCRIPT_NAME} but was not found on PATH. Install jq and try again (e.g. 'brew install jq' or 'apt-get install jq')." >&2
  exit 1
fi

# --- Helpers --------------------------------------------------------------

# emit_feature_json FEATURE NUMBER SLUG DIR [EXISTING]
# Prints the single-line JSON contract; jq handles escaping of the path.
emit_feature_json() {
  local feature="$1" number="$2" slug="$3" dir="$4" existing="${5:-false}"
  jq -c -n \
    --arg feature "${feature}" \
    --arg number "${number}" \
    --arg slug "${slug}" \
    --arg dir "${dir}" \
    --argjson existing "${existing}" \
    '{feature: $feature, number: $number, slug: $slug, dir: $dir, branch: $feature}
     + (if $existing then {existing: true} else {} end)'
}

# --- Argument parsing ---------------------------------------------------

SLUG=""

# set_slug VALUE
# Records the positional <slug>, rejecting a second positional argument.
set_slug() {
  if [[ -n "${SLUG}" ]]; then
    echo "Error: unexpected extra argument '$1'" >&2
    exit 1
  fi
  SLUG="$1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --json)
      # Default output format; accepted as a no-op for explicitness.
      shift
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "Error: unknown option '$1'" >&2
      usage >&2
      exit 1
      ;;
    *)
      set_slug "$1"
      shift
      ;;
  esac
done

# Everything after "--" is positional.
for arg in "$@"; do
  set_slug "${arg}"
done

if [[ -z "${SLUG}" ]]; then
  echo "Error: missing required <slug> argument" >&2
  usage >&2
  exit 1
fi

# Validate slug: lowercase letters, digits, hyphens only.
if [[ ! "${SLUG}" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "Error: invalid slug '${SLUG}' - must be kebab-case (lowercase letters, digits, hyphens only)" >&2
  exit 1
fi

# --- Resolve project root and .spek/specs/ directory ---------------------------

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SPECS_DIR="${PROJECT_ROOT}/.spek/specs"

mkdir -p "${SPECS_DIR}"

# --- Check for an existing feature directory with this slug --------------

EXISTING_DIR=""
for candidate in "${SPECS_DIR}"/*"-${SLUG}"; do
  [[ -d "${candidate}" ]] || continue
  base="$(basename "${candidate}")"
  # Only match the strict NNN-slug pattern to avoid accidental substring hits.
  if [[ "${base}" =~ ^([0-9]{3})-${SLUG}$ ]]; then
    EXISTING_DIR="${candidate}"
    EXISTING_NUMBER="${BASH_REMATCH[1]}"
    break
  fi
done

if [[ -n "${EXISTING_DIR}" ]]; then
  FEATURE="${EXISTING_NUMBER}-${SLUG}"
  emit_feature_json "${FEATURE}" "${EXISTING_NUMBER}" "${SLUG}" "${EXISTING_DIR}" true
  exit 0
fi

# --- Compute the next sequential number -----------------------------------

MAX_NUMBER=0
for candidate in "${SPECS_DIR}"/*/; do
  [[ -d "${candidate}" ]] || continue
  base="$(basename "${candidate}")"
  if [[ "${base}" =~ ^([0-9]{3})- ]]; then
    num="${BASH_REMATCH[1]}"
    # Force base-10 interpretation to avoid octal parsing of zero-padded numbers.
    num=$((10#${num}))
    if (( num > MAX_NUMBER )); then
      MAX_NUMBER=${num}
    fi
  fi
done

NEXT_NUMBER=$((MAX_NUMBER + 1))
NUMBER=$(printf '%03d' "${NEXT_NUMBER}")
FEATURE="${NUMBER}-${SLUG}"
FEATURE_DIR="${SPECS_DIR}/${FEATURE}"

mkdir -p "${FEATURE_DIR}"

emit_feature_json "${FEATURE}" "${NUMBER}" "${SLUG}" "${FEATURE_DIR}"
