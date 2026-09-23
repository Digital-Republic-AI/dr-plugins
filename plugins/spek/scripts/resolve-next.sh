#!/usr/bin/env bash
set -euo pipefail

# resolve-next.sh - Read-only navigation resolver for the /spek commands.
#
# Answers, deterministically, the three questions the navigation commands
# (/spek:start, /spek:next) and the dashboard (/spek:status) need:
#   1. What does the project look like? (.spek/ present, constitution present,
#      how many features, how many still active)
#   2. Which feature is "current"? (explicit argument, or the most recently
#      updated feature that is not yet verified/archived)
#   3. What is the next natural SDD command for it, and why?
#
# All of that logic lives here so the LLM driving the commands never has to
# compute phases, pick features or remember the phase -> command map itself.
# The map is documented in skills/sdd-templates/references/conventions.md,
# section "Navigation"; this script is its implementation.
#
# Usage:
#   resolve-next.sh [feature]
#
# Arguments:
#   [feature]   Optional. Selects the feature explicitly, as NNN-slug, slug, or
#               a path to the feature directory. Without it, the most recently
#               updated active feature is selected.
#
# Output (stdout, single-line JSON):
#   {
#     "project": { "spekDir": bool, "constitution": bool, "featureCount": n, "activeCount": n },
#     "feature": null | {
#       "feature": "NNN-slug", "slug": "slug", "dir": "<absolute path>",
#       "phase": "...", "mode": "light|normal", "context": "greenfield|brownfield",
#       "stateSource": "state|inferred",
#       "clarifications": n, "totalTasks": n, "completedTasks": n, "pendingTasks": n,
#       "handoff": null | { "status": "in-progress|failed", "tasks": ["T004"], "note": "...", "at": "..." },
#       "artifacts": { "baseline": bool, "spec": bool, "plan": bool, "tasks": bool, "verifyReport": bool }
#     },
#     "next": { "command": "...", "args": "...", "reason": "..." }
#   }
#
#   next.command is one of: start, specify, clarify, plan, tasks, implement,
#   verify, none. "start" means there is no active feature to advance; "none"
#   means the explicitly selected feature is already terminal.
#
#   stateSource is "state" when state.json was read, or "inferred" when it is
#   missing/invalid and the phase was derived from which artifacts exist. This
#   script never writes: restoring state.json is the caller's job (through
#   update-state.sh).
#
#   handoff is the record written by /spek:implement (through update-state.sh
#   set-handoff) of the batch that was in progress or the tasks that failed
#   when the last run stopped. It is copied verbatim from state.json and is
#   null when absent or when the state was inferred. While the phase is
#   "implement" with pending tasks, next.reason also names the tasks to resume.
#
# Errors go to stderr with exit code 1 (unknown feature, invalid arguments,
# missing jq).
#
# Environment:
#   CLAUDE_PROJECT_DIR   Project root. Defaults to the current working
#                        directory when unset.
#
# Requirements:
#   jq must be available on PATH.

SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

# Phases allowed in the `phase` field, in lifecycle order (mirrors update-state.sh).
ALLOWED_PHASES=(extract specify clarify plan tasks implement implement-complete verified archived)
# Phases after which a feature no longer takes part in the default selection.
TERMINAL_PHASES=(verified archived)

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} [feature]

Read-only resolver of the current feature and its next SDD command.

Arguments:
  [feature]    Optional. NNN-slug, slug, or path of the feature directory.
               Without it, the most recently updated feature that is not yet
               verified/archived is selected.

Options:
  -h, --help   Show this help message and exit.

Output:
  A single-line JSON object on stdout with "project", "feature" and "next"
  (see the header comment of this script for the full contract).
EOF
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

REQUESTED=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Error: unknown option '$1'" >&2
      usage >&2
      exit 1
      ;;
    *)
      [[ -z "${REQUESTED}" ]] || die "unexpected extra argument '$1'"
      REQUESTED="$1"
      shift
      ;;
  esac
done

# --- Helpers ----------------------------------------------------------------

in_list() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    [[ "${item}" == "${needle}" ]] && return 0
  done
  return 1
}

bool() {
  if [[ -e "$1" ]]; then echo true; else echo false; fi
}

count_matches() {
  # grep -c exits 1 when there is no match; that is a legitimate 0 here.
  local pattern="$1" file="$2" n
  n="$(grep -c -E "${pattern}" "${file}" 2>/dev/null || true)"
  echo "${n:-0}"
}

mtime_utc() {
  # ISO-8601 UTC timestamp of a path's last modification, portable across
  # GNU (Linux) and BSD (macOS) userlands.
  local path="$1" epoch
  if stat -c %Y "${path}" >/dev/null 2>&1; then
    epoch="$(stat -c %Y "${path}")"
  else
    epoch="$(stat -f %m "${path}")"
  fi
  if date -u -d "@0" >/dev/null 2>&1; then
    date -u -d "@${epoch}" +%Y-%m-%dT%H:%M:%SZ
  else
    date -u -r "${epoch}" +%Y-%m-%dT%H:%M:%SZ
  fi
}

# Phase inferred from artifact presence, in the order fixed by conventions.md
# ("Phase-detection mechanism"). Used only when state.json is missing/invalid.
infer_phase() {
  local dir="$1" total="$2" completed="$3"
  if [[ -f "${dir}/tasks.md" ]]; then
    if (( total > 0 && completed == total )); then echo implement-complete
    elif (( completed > 0 )); then echo implement
    else echo tasks
    fi
  elif [[ -f "${dir}/plan.md" ]]; then echo plan
  elif [[ -f "${dir}/spec.md" ]]; then echo specify
  elif [[ -f "${dir}/baseline.md" ]]; then echo extract
  else echo ""
  fi
}

# Emits one compact JSON object describing a feature directory, or nothing
# when the directory holds neither a state file nor any artifact (an empty
# leftover directory is not a feature).
describe_feature() {
  local dir="$1"
  local base feature slug state_file
  local phase mode context updated source
  local total completed pending clarifications handoff

  base="$(basename "${dir}")"
  feature="${base}"
  slug="${base#[0-9][0-9][0-9]-}"
  state_file="${dir}/state.json"

  total=0; completed=0
  if [[ -f "${dir}/tasks.md" ]]; then
    total="$(count_matches '^[[:space:]]*- \[[ xX]\]' "${dir}/tasks.md")"
    completed="$(count_matches '^[[:space:]]*- \[[xX]\]' "${dir}/tasks.md")"
  fi
  pending=$((total - completed))

  clarifications=0
  if [[ -f "${dir}/spec.md" ]]; then
    clarifications="$(count_matches 'NEEDS CLARIFICATION' "${dir}/spec.md")"
  fi

  source=""
  handoff="null"
  if [[ -f "${state_file}" ]] && jq -e . "${state_file}" >/dev/null 2>&1; then
    phase="$(jq -r '.phase // ""' "${state_file}")"
    mode="$(jq -r '.mode // "normal"' "${state_file}")"
    context="$(jq -r '.context // "greenfield"' "${state_file}")"
    updated="$(jq -r '.updated // ""' "${state_file}")"
    if in_list "${phase}" "${ALLOWED_PHASES[@]}"; then
      source="state"
      # Copied verbatim: the resolver never interprets the handoff, it only
      # surfaces it (and names its tasks in next.reason).
      handoff="$(jq -c '.handoff // null' "${state_file}")"
    fi
  fi

  if [[ -z "${source}" ]]; then
    phase="$(infer_phase "${dir}" "${total}" "${completed}")"
    [[ -n "${phase}" ]] || return 0
    mode="normal"
    if [[ -f "${dir}/baseline.md" ]]; then context="brownfield"; else context="greenfield"; fi
    updated="$(mtime_utc "${dir}")"
    source="inferred"
  fi
  [[ "${mode}" == "light" || "${mode}" == "normal" ]] || mode="normal"
  [[ -n "${updated}" ]] || updated="$(mtime_utc "${dir}")"

  jq -c -n \
    --arg feature "${feature}" \
    --arg slug "${slug}" \
    --arg dir "${dir}" \
    --arg phase "${phase}" \
    --arg mode "${mode}" \
    --arg context "${context}" \
    --arg updated "${updated}" \
    --arg source "${source}" \
    --argjson clarifications "${clarifications}" \
    --argjson total "${total}" \
    --argjson completed "${completed}" \
    --argjson pending "${pending}" \
    --argjson handoff "${handoff}" \
    --argjson baseline "$(bool "${dir}/baseline.md")" \
    --argjson spec "$(bool "${dir}/spec.md")" \
    --argjson plan "$(bool "${dir}/plan.md")" \
    --argjson tasks "$(bool "${dir}/tasks.md")" \
    --argjson report "$(bool "${dir}/verify-report.md")" \
    '{
      feature: $feature, slug: $slug, dir: $dir,
      phase: $phase, mode: $mode, context: $context, updated: $updated,
      stateSource: $source,
      clarifications: $clarifications,
      totalTasks: $total, completedTasks: $completed, pendingTasks: $pending,
      handoff: $handoff,
      artifacts: { baseline: $baseline, spec: $spec, plan: $plan, tasks: $tasks, verifyReport: $report }
    }'
}

# One-line hint for next.reason from the feature's handoff, or an empty string
# when there is none: "resume at T004, T005 (failed: <note>)". The note is
# truncated and stripped of tabs/newlines so the reason stays a single field.
handoff_hint() {
  local f="$1"
  jq -r '
    .handoff as $h
    | if $h == null then ""
      else
        (if ($h.tasks | length) > 0 then "resume at " + ($h.tasks | join(", ")) else "resume" end)
        + " (" + $h.status + ": "
        + ($h.note | gsub("[\\t\\r\\n]+"; " ") | if length > 80 then .[:77] + "..." else . end)
        + ")"
      end
  ' <<<"${f}"
}

# Prints "<command>\t<args>\t<reason>" for a feature JSON object.
next_for() {
  local f="$1"
  local feature slug phase mode clar pending total hint
  feature="$(jq -r '.feature' <<<"${f}")"
  slug="$(jq -r '.slug' <<<"${f}")"
  phase="$(jq -r '.phase' <<<"${f}")"
  mode="$(jq -r '.mode' <<<"${f}")"
  clar="$(jq -r '.clarifications' <<<"${f}")"
  pending="$(jq -r '.pendingTasks' <<<"${f}")"
  total="$(jq -r '.totalTasks' <<<"${f}")"

  case "${phase}" in
    extract)
      printf 'specify\t--slug=%s\tbaseline.md exists but the change has not been specified yet\n' "${slug}"
      ;;
    specify|clarify)
      if (( clar > 0 )); then
        printf 'clarify\t%s\tspec.md has %s [NEEDS CLARIFICATION] marker(s)\n' "${feature}" "${clar}"
      elif [[ "${mode}" == "light" ]]; then
        printf 'implement\t%s\tspec.md is complete and light mode skips plan and tasks\n' "${feature}"
      else
        printf 'plan\t%s\tspec.md is complete and there is no technical plan yet\n' "${feature}"
      fi
      ;;
    plan)
      printf 'tasks\t%s\tplan.md exists but has not been decomposed into tasks\n' "${feature}"
      ;;
    tasks)
      printf 'implement\t%s\ttasks.md has %s pending task(s)\n' "${feature}" "${pending}"
      ;;
    implement)
      if (( pending > 0 )); then
        hint="$(handoff_hint "${f}")"
        if [[ -n "${hint}" ]]; then
          printf 'implement\t%s\ttasks.md still has %s pending task(s); %s\n' "${feature}" "${pending}" "${hint}"
        else
          printf 'implement\t%s\ttasks.md still has %s pending task(s)\n' "${feature}" "${pending}"
        fi
      else
        printf 'verify\t%s\tall %s task(s) in tasks.md are ticked\n' "${feature}" "${total}"
      fi
      ;;
    implement-complete)
      printf 'verify\t%s\timplementation is complete and not yet verified\n' "${feature}"
      ;;
    verified|archived)
      printf 'none\t%s\tfeature is already %s\n' "${feature}" "${phase}"
      ;;
    *)
      die "unknown phase '${phase}' for feature '${feature}'"
      ;;
  esac
}

# --- Project facts ----------------------------------------------------------

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SPEK_DIR="${PROJECT_ROOT}/.spek"
SPECS_DIR="${SPEK_DIR}/specs"

SPEK_DIR_EXISTS="$(bool "${SPEK_DIR}")"
CONSTITUTION_EXISTS="$(bool "${SPEK_DIR}/constitution.md")"

# --- Enumerate features -----------------------------------------------------

FEATURES=()   # one compact JSON object per feature
if [[ -d "${SPECS_DIR}" ]]; then
  for candidate in "${SPECS_DIR}"/*/; do
    [[ -d "${candidate}" ]] || continue
    candidate="${candidate%/}"
    [[ "$(basename "${candidate}")" =~ ^[0-9]{3}- ]] || continue
    described="$(describe_feature "${candidate}")"
    [[ -n "${described}" ]] || continue
    FEATURES+=("${described}")
  done
fi

FEATURE_COUNT="${#FEATURES[@]}"
ACTIVE_COUNT=0
for f in "${FEATURES[@]+"${FEATURES[@]}"}"; do
  phase="$(jq -r '.phase' <<<"${f}")"
  in_list "${phase}" "${TERMINAL_PHASES[@]}" || ACTIVE_COUNT=$((ACTIVE_COUNT + 1))
done

# --- Select the current feature ------------------------------------------------

SELECTED=""
if [[ -n "${REQUESTED}" ]]; then
  wanted="${REQUESTED%/}"
  [[ -d "${wanted}" ]] && wanted="$(basename "${wanted}")"
  wanted="$(basename "${wanted}")"
  for f in "${FEATURES[@]+"${FEATURES[@]}"}"; do
    feature="$(jq -r '.feature' <<<"${f}")"
    slug="$(jq -r '.slug' <<<"${f}")"
    if [[ "${feature}" == "${wanted}" || "${slug}" == "${wanted}" ]]; then
      SELECTED="${f}"
      break
    fi
  done
  [[ -n "${SELECTED}" ]] || die "feature '${REQUESTED}' not found under '${SPECS_DIR}'"
else
  best_updated=""
  for f in "${FEATURES[@]+"${FEATURES[@]}"}"; do
    phase="$(jq -r '.phase' <<<"${f}")"
    in_list "${phase}" "${TERMINAL_PHASES[@]}" && continue
    updated="$(jq -r '.updated' <<<"${f}")"
    if [[ -z "${best_updated}" || "${updated}" > "${best_updated}" ]]; then
      best_updated="${updated}"
      SELECTED="${f}"
    fi
  done
fi

# --- Compute the next command ----------------------------------------------------

if [[ -n "${SELECTED}" ]]; then
  IFS=$'\t' read -r NEXT_COMMAND NEXT_ARGS NEXT_REASON <<<"$(next_for "${SELECTED}")"
  FEATURE_JSON="${SELECTED}"
else
  NEXT_COMMAND="start"
  NEXT_ARGS=""
  if [[ "${SPEK_DIR_EXISTS}" != "true" ]]; then
    NEXT_REASON="the project has no .spek/ directory yet"
  elif (( FEATURE_COUNT == 0 )); then
    NEXT_REASON="no feature exists under .spek/specs/ yet"
  else
    NEXT_REASON="every feature is already verified or archived"
  fi
  FEATURE_JSON="null"
fi

jq -c -n \
  --argjson spekDir "${SPEK_DIR_EXISTS}" \
  --argjson constitution "${CONSTITUTION_EXISTS}" \
  --argjson featureCount "${FEATURE_COUNT}" \
  --argjson activeCount "${ACTIVE_COUNT}" \
  --argjson feature "${FEATURE_JSON}" \
  --arg command "${NEXT_COMMAND}" \
  --arg args "${NEXT_ARGS}" \
  --arg reason "${NEXT_REASON}" \
  '{
    project: { spekDir: $spekDir, constitution: $constitution, featureCount: $featureCount, activeCount: $activeCount },
    feature: $feature,
    next: { command: $command, args: $args, reason: $reason }
  }'
