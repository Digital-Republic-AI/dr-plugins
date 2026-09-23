#!/usr/bin/env bash
set -euo pipefail

# scaffold.sh - Deterministic artifact scaffolder of the sdd-templates skill.
#
# Copies the canonical template of an SDD artifact into the feature directory
# (or, for the constitution, into .spek/ at the project root), strips the
# <!-- ... --> guidance blocks that are meant for the writer and never for the
# artifact, fills the deterministic header placeholders ([DATE], [NNN-slug],
# [NNN-feature-slug], [PROJECT NAME]) and prints a single-line JSON result.
# The remaining [PLACEHOLDER] tokens are the subagent's job to fill with
# Edit/MultiEdit after it has analyzed the input.
#
# It enforces the same ordering rules as the PreToolUse hook (shared lib
# scripts/lib/prereq.sh), so scaffolding through bash cannot bypass them.
#
# Usage:
#   scaffold.sh <artifact> [target-dir] [--force]
#
# Arguments:
#   <artifact>     baseline | spec | spec-light | plan | tasks | constitution
#   [target-dir]   Feature directory (.spek/specs/NNN-slug) for feature
#                  artifacts. For "constitution" it is the project root
#                  (default: CLAUDE_PROJECT_DIR, else the current directory)
#                  and the file is written to <root>/.spek/constitution.md.
#
# Options:
#   --force        Overwrite an existing target file. The baseline freeze
#                  (baseline.md once spec.md exists) is never overridden.
#   -h, --help     Show this help message and exit.
#
# Output (stdout, single line JSON):
#   {"artifact":"...","path":"<absolute path>","template":"<absolute path>",
#    "feature":"NNN-slug"|null,"placeholders":n,"overwritten":bool}
#
# Errors go to stderr with exit code 1 (unknown artifact, missing dir,
# ordering rule violated, target exists without --force, missing jq).
#
# Requirements:
#   jq must be available on PATH.

SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_ROOT="$(cd "${SKILL_DIR}/../.." && pwd)"
TEMPLATES_DIR="${SKILL_DIR}/references"

# shellcheck source=scripts/lib/prereq.sh
source "${PLUGIN_ROOT}/scripts/lib/prereq.sh"

usage() {
  cat <<USAGE
Usage: ${SCRIPT_NAME} <artifact> [target-dir] [--force]

Scaffold an SDD artifact from its canonical template.

Arguments:
  <artifact>     baseline | spec | spec-light | plan | tasks | constitution
  [target-dir]   Feature directory (.spek/specs/NNN-slug). For "constitution",
                 the project root (default: CLAUDE_PROJECT_DIR or the current
                 directory); the file goes to <root>/.spek/constitution.md.

Options:
  --force        Overwrite an existing target file (never overrides the
                 baseline freeze).
  -h, --help     Show this help message and exit.

Output:
  {"artifact":"...","path":"...","template":"...","feature":"NNN-slug"|null,
   "placeholders":n,"overwritten":bool}
USAGE
}

die() {
  echo "Error: $*" >&2
  exit 1
}

# --- Dependency check -----------------------------------------------------

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: 'jq' is required by ${SCRIPT_NAME} but was not found on PATH. Install jq and try again (e.g. 'brew install jq' or 'apt-get install jq')." >&2
  exit 1
fi

# --- Argument parsing -----------------------------------------------------

ARTIFACT=""
TARGET_DIR=""
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --force) FORCE=true; shift ;;
    -*) echo "Error: unknown option '$1'" >&2; usage >&2; exit 1 ;;
    *)
      if [[ -z "${ARTIFACT}" ]]; then ARTIFACT="$1"
      elif [[ -z "${TARGET_DIR}" ]]; then TARGET_DIR="$1"
      else die "unexpected extra argument '$1'"
      fi
      shift ;;
  esac
done

[[ -n "${ARTIFACT}" ]] || { echo "Error: missing required <artifact> argument" >&2; usage >&2; exit 1; }

# --- Resolve template and target ------------------------------------------

case "${ARTIFACT}" in
  baseline)     TEMPLATE="baseline-template.md";     FILE_NAME="baseline.md" ;;
  spec)         TEMPLATE="spec-template.md";         FILE_NAME="spec.md" ;;
  spec-light)   TEMPLATE="spec-light-template.md";   FILE_NAME="spec.md" ;;
  plan)         TEMPLATE="plan-template.md";         FILE_NAME="plan.md" ;;
  tasks)        TEMPLATE="tasks-template.md";        FILE_NAME="tasks.md" ;;
  constitution) TEMPLATE="constitution-template.md"; FILE_NAME="constitution.md" ;;
  *) die "unknown artifact '${ARTIFACT}' - expected baseline, spec, spec-light, plan, tasks or constitution" ;;
esac

TEMPLATE_PATH="${TEMPLATES_DIR}/${TEMPLATE}"
[[ -f "${TEMPLATE_PATH}" ]] || die "template '${TEMPLATE_PATH}' not found"

FEATURE="null"
if [[ "${ARTIFACT}" == "constitution" ]]; then
  PROJECT_ROOT="${TARGET_DIR:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
  [[ -d "${PROJECT_ROOT}" ]] || die "project root '${PROJECT_ROOT}' does not exist"
  PROJECT_ROOT="$(cd "${PROJECT_ROOT}" && pwd)"
  TARGET_DIR="${PROJECT_ROOT}/.spek"
  mkdir -p "${TARGET_DIR}"
  PROJECT_NAME="$(basename "${PROJECT_ROOT}")"
else
  [[ -n "${TARGET_DIR}" ]] || die "'${ARTIFACT}' requires the feature directory as <target-dir>"
  [[ -d "${TARGET_DIR}" ]] || die "feature directory '${TARGET_DIR}' does not exist - create it with new-feature.sh first"
  TARGET_DIR="$(cd "${TARGET_DIR}" && pwd)"
  FEATURE_NAME="$(basename "${TARGET_DIR}")"
  [[ "${FEATURE_NAME}" =~ ^[0-9]{3}- ]] || die "'${TARGET_DIR}' is not a feature directory (expected .spek/specs/NNN-slug)"
  FEATURE="\"${FEATURE_NAME}\""
  PROJECT_NAME=""
fi

TARGET_PATH="${TARGET_DIR}/${FILE_NAME}"

# --- Ordering rules and overwrite policy -----------------------------------

if [[ "${ARTIFACT}" != "constitution" ]]; then
  artifact_write_blocked "${TARGET_DIR}" "${FILE_NAME}" || exit 1
fi

OVERWRITTEN=false
if [[ -e "${TARGET_PATH}" ]]; then
  [[ "${FORCE}" == "true" ]] || die "'${TARGET_PATH}' already exists - pass --force to overwrite it"
  OVERWRITTEN=true
fi

# --- Render ----------------------------------------------------------------

TODAY="$(date -u +%Y-%m-%d)"
FEATURE_SED="${FEATURE_NAME:-}"

# 1. Drop guidance comments: whole-line <!-- ... --> blocks (single or multi
#    line) and inline "<!-- ... -->" tails. 2. Fill deterministic placeholders.
# 3. Collapse runs of blank lines left behind.
RENDERED="$(
  sed -E '/^[[:space:]]*<!--/,/-->[[:space:]]*$/d; s/[[:space:]]*<!--.*-->[[:space:]]*$//' "${TEMPLATE_PATH}" \
    | sed -e "s/\[DATE\]/${TODAY}/g" \
          -e "s/\[NNN-feature-slug\]/${FEATURE_SED}/g" \
          -e "s/\[NNN-slug\]/${FEATURE_SED}/g" \
          -e "s/\[PROJECT NAME\]/${PROJECT_NAME}/g" \
    | cat -s
)"

TMP="$(mktemp "${TARGET_DIR}/${FILE_NAME}.XXXXXX")"
printf '%s\n' "${RENDERED}" >"${TMP}"
mv "${TMP}" "${TARGET_PATH}"

PLACEHOLDERS="$(grep -o -E '\[[A-Z][A-Za-z0-9 /,.:-]*\]' "${TARGET_PATH}" | wc -l | tr -d ' ')"

jq -c -n \
  --arg artifact "${ARTIFACT}" \
  --arg path "${TARGET_PATH}" \
  --arg template "${TEMPLATE_PATH}" \
  --argjson feature "${FEATURE}" \
  --argjson placeholders "${PLACEHOLDERS:-0}" \
  --argjson overwritten "${OVERWRITTEN}" \
  '{artifact: $artifact, path: $path, template: $template, feature: $feature, placeholders: $placeholders, overwritten: $overwritten}'
