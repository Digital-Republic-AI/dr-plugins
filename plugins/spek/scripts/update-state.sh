#!/usr/bin/env bash
# jq filters below are single-quoted on purpose: $name tokens are jq variables
# bound with --arg, not shell expansions.
# shellcheck disable=SC2016
set -euo pipefail

# update-state.sh - Deterministic writer for a feature's state.json.
#
# This script is the ONLY component allowed to write state.json. All
# state transitions (phase changes, mode changes, task counters, branch
# association) go through it, so timestamps and counters are always real and
# never invented by the model driving the /spek commands.
#
# Usage:
#   update-state.sh <feature-dir> <operation> [args...]
#
# Operations:
#   init <feature> <slug> <mode> [phase]
#                                  Create state.json for a new feature.
#                                  The optional 5th argument sets the starting
#                                  phase (default "specify"); /spek:extract uses
#                                  "extract". Fails if the file already exists.
#   set-phase <phase>              Set the current phase and append it to
#                                  history (only when it differs from the last
#                                  history entry).
#   set-mode <light|normal>        Set the feature mode (effort level).
#   set-context <greenfield|brownfield>
#                                  Set the feature context. Independent of mode:
#                                  `mode` is how much ceremony the change gets,
#                                  `context` is whether the change starts from
#                                  existing code (brownfield, set by
#                                  /spek:extract) or from nothing (greenfield).
#   set-branch <branch>            Set the git branch associated with the feature.
#   sync-tasks                     Derive totalTasks/completedTasks by counting the
#                                  checkboxes in <feature-dir>/tasks.md. PREFERRED:
#                                  tasks.md is the source of truth, so the counters
#                                  can never drift out of sync with it.
#   set-tasks <total>              Set totalTasks and reset completedTasks to 0.
#                                  Kept for backward compatibility - prefer sync-tasks.
#   task-done                      Increment completedTasks by 1 (capped at totalTasks).
#                                  Kept for backward compatibility - prefer sync-tasks.
#   set-handoff <in-progress|failed> "<note>" [T00X ...]
#                                  Record where an implementation run stopped:
#                                  the batch being executed (in-progress, written
#                                  BEFORE dispatching so a killed session leaves
#                                  it behind) or the tasks that failed (failed,
#                                  with the error summary in the note). Task ids
#                                  must match T[0-9]+; the list may be empty
#                                  (light mode has no tasks.md).
#   clear-handoff                  Remove the handoff. No-op (exit 0) when absent.
#                                  set-phase to any phase other than "implement"
#                                  also removes it, so a regenerated tasks.md or a
#                                  finished implementation never leaves a stale
#                                  reference behind.
#   get                            Print the current state without writing.
#
# Output:
#   The resulting state JSON is printed to stdout after every successful
#   operation. Errors go to stderr with exit code 1.
#
# Requirements:
#   jq must be available on PATH.

SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

# Phases allowed in the `phase` field, in lifecycle order.
ALLOWED_PHASES=(extract specify clarify plan tasks implement implement-complete verified archived)

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} <feature-dir> <operation> [args...]

The single writer of <feature-dir>/state.json.

Operations:
  init <feature> <slug> <mode> [phase]
                                 Create the state file (fails if it exists).
                                 [phase] defaults to 'specify'; /spek:extract
                                 passes 'extract'. Context starts as
                                 'greenfield'.
  set-phase <phase>              Set phase and append it to history when new.
  set-mode <light|normal>        Set the feature mode (effort level).
  set-context <greenfield|brownfield>
                                 Set the feature context (brownfield when the
                                 change starts from a baseline of existing
                                 code). Independent of mode.
  set-branch <branch>            Set the associated git branch.
  sync-tasks                     Derive the task counters from tasks.md checkboxes
                                 (preferred, drift-proof).
  set-tasks <total>              Set totalTasks and reset completedTasks to 0
                                 (legacy - prefer sync-tasks).
  task-done                      Increment completedTasks (capped at totalTasks)
                                 (legacy - prefer sync-tasks).
  set-handoff <in-progress|failed> "<note>" [T00X ...]
                                 Record the batch in progress or the failed
                                 tasks (ids match T[0-9]+; list may be empty).
  clear-handoff                  Remove the handoff (no-op when absent).
                                 set-phase to a phase other than 'implement'
                                 removes it too.
  get                            Print the current state (no write).

Allowed phases:
  ${ALLOWED_PHASES[*]}

All timestamps are generated by this script (UTC, ISO 8601). They are never
taken from arguments.
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

if [[ $# -eq 0 ]]; then
  usage >&2
  exit 1
fi

case "$1" in
  -h|--help)
    usage
    exit 0
    ;;
esac

if [[ $# -lt 2 ]]; then
  echo "Error: missing required arguments" >&2
  usage >&2
  exit 1
fi

FEATURE_DIR="$1"
OPERATION="$2"
shift 2

[[ -d "${FEATURE_DIR}" ]] || die "feature directory '${FEATURE_DIR}' does not exist"

STATE_FILE="${FEATURE_DIR}/state.json"

# --- Helpers --------------------------------------------------------------

now_utc() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

require_state_file() {
  [[ -f "${STATE_FILE}" ]] || die "state file '${STATE_FILE}' not found - run '${SCRIPT_NAME} ${FEATURE_DIR} init <feature> <slug> <mode> [phase]' first"
}

# write_state <json>
# Atomically replaces the state file: writes to a temp file in the same
# directory (same filesystem, so mv is atomic) and then moves it into place.
write_state() {
  local content="$1"
  local tmp
  tmp="$(mktemp "${FEATURE_DIR}/state.json.XXXXXX")"
  printf '%s\n' "${content}" >"${tmp}"
  mv "${tmp}" "${STATE_FILE}"
}

is_allowed_phase() {
  local candidate="$1"
  local phase
  for phase in "${ALLOWED_PHASES[@]}"; do
    [[ "${phase}" == "${candidate}" ]] && return 0
  done
  return 1
}

# jq_update <filter> [--arg name value ...]
# Applies a jq filter to the current state and writes the result back.
jq_update() {
  local filter="$1"
  shift
  require_state_file
  local updated
  updated="$(jq "$@" --arg now "$(now_utc)" "${filter}" "${STATE_FILE}")" \
    || die "failed to update '${STATE_FILE}' (invalid JSON?)"
  write_state "${updated}"
  printf '%s\n' "${updated}"
}

# --- Operations -----------------------------------------------------------

case "${OPERATION}" in
  init)
    [[ $# -eq 3 || $# -eq 4 ]] \
      || die "'init' requires 3 or 4 arguments: <feature> <slug> <mode> [phase]"
    FEATURE="$1"
    SLUG="$2"
    MODE="$3"
    # The starting phase is "specify" for the greenfield flow; /spek:extract
    # passes "extract" so the very first state is not mislabelled.
    PHASE="${4:-specify}"
    [[ "${MODE}" == "light" || "${MODE}" == "normal" ]] \
      || die "invalid mode '${MODE}' - must be 'light' or 'normal'"
    is_allowed_phase "${PHASE}" \
      || die "invalid phase '${PHASE}' - allowed values: ${ALLOWED_PHASES[*]}"
    [[ ! -e "${STATE_FILE}" ]] \
      || die "state file '${STATE_FILE}' already exists - refusing to overwrite (use set-phase/set-mode/set-context/set-branch to update it)"

    NOW="$(now_utc)"
    NEW_STATE="$(jq -n \
      --arg feature "${FEATURE}" \
      --arg slug "${SLUG}" \
      --arg mode "${MODE}" \
      --arg phase "${PHASE}" \
      --arg now "${NOW}" \
      '{
        feature: $feature,
        slug: $slug,
        mode: $mode,
        context: "greenfield",
        phase: $phase,
        created: $now,
        updated: $now,
        history: [$phase],
        branch: null
      }')"
    write_state "${NEW_STATE}"
    printf '%s\n' "${NEW_STATE}"
    ;;

  set-phase)
    [[ $# -eq 1 ]] || die "'set-phase' requires exactly 1 argument: <phase>"
    PHASE="$1"
    is_allowed_phase "${PHASE}" \
      || die "invalid phase '${PHASE}' - allowed values: ${ALLOWED_PHASES[*]}"
    # Append to history only when the phase differs from the last entry, so a
    # command run twice never duplicates consecutive entries. Leaving the
    # implement phase drops the handoff: its task ids only mean something
    # against the tasks.md of the run that wrote it.
    jq_update '
      .phase = $phase
      | .history = ((.history // []) as $h
          | if ($h | length) > 0 and ($h[-1] == $phase) then $h else $h + [$phase] end)
      | (if $phase != "implement" then del(.handoff) else . end)
      | .updated = $now
    ' --arg phase "${PHASE}"
    ;;

  set-mode)
    [[ $# -eq 1 ]] || die "'set-mode' requires exactly 1 argument: <light|normal>"
    MODE="$1"
    [[ "${MODE}" == "light" || "${MODE}" == "normal" ]] \
      || die "invalid mode '${MODE}' - must be 'light' or 'normal'"
    jq_update '.mode = $mode | .updated = $now' --arg mode "${MODE}"
    ;;

  set-context)
    # `context` answers "does this change start from existing code?" and is
    # deliberately separate from `mode` (light|normal), which only says how
    # much ceremony the change gets.
    [[ $# -eq 1 ]] || die "'set-context' requires exactly 1 argument: <greenfield|brownfield>"
    CONTEXT="$1"
    [[ "${CONTEXT}" == "greenfield" || "${CONTEXT}" == "brownfield" ]] \
      || die "invalid context '${CONTEXT}' - must be 'greenfield' or 'brownfield'"
    jq_update '.context = $context | .updated = $now' --arg context "${CONTEXT}"
    ;;

  set-branch)
    [[ $# -eq 1 ]] || die "'set-branch' requires exactly 1 argument: <branch>"
    BRANCH="$1"
    [[ -n "${BRANCH}" ]] || die "'set-branch' requires a non-empty branch name"
    jq_update '.branch = $branch | .updated = $now' --arg branch "${BRANCH}"
    ;;

  sync-tasks)
    # Preferred, drift-proof path: tasks.md is the source of truth, so both
    # counters are DERIVED from its checkboxes instead of being incremented.
    [[ $# -eq 0 ]] || die "'sync-tasks' takes no arguments"
    TASKS_FILE="${FEATURE_DIR}/tasks.md"
    [[ -f "${TASKS_FILE}" ]] \
      || die "tasks file '${TASKS_FILE}' not found - run '/spek:tasks' first (or use set-tasks for a feature without tasks.md)"

    # A task line is a markdown checkbox item, optionally indented:
    #   - [ ] T001 ...   (pending)
    #   - [x] T001 ...   (done, upper or lower case X)
    TOTAL="$(grep -c -E '^[[:space:]]*- \[[ xX]\]' "${TASKS_FILE}" || true)"
    COMPLETED="$(grep -c -E '^[[:space:]]*- \[[xX]\]' "${TASKS_FILE}" || true)"
    TOTAL="${TOTAL:-0}"
    COMPLETED="${COMPLETED:-0}"

    jq_update '
      .totalTasks = ($total | tonumber)
      | .completedTasks = ($completed | tonumber)
      | .updated = $now
    ' --arg total "${TOTAL}" --arg completed "${COMPLETED}"
    ;;

  set-tasks)
    # Legacy: prefer 'sync-tasks', which derives the counters from tasks.md.
    [[ $# -eq 1 ]] || die "'set-tasks' requires exactly 1 argument: <total>"
    TOTAL="$1"
    [[ "${TOTAL}" =~ ^[0-9]+$ ]] \
      || die "invalid total '${TOTAL}' - must be a non-negative integer"
    jq_update '
      .totalTasks = ($total | tonumber)
      | .completedTasks = 0
      | .updated = $now
    ' --arg total "${TOTAL}"
    ;;

  task-done)
    # Legacy: prefer 'sync-tasks'. Incrementing can drift from tasks.md, which
    # is the real source of truth for progress.
    [[ $# -eq 0 ]] || die "'task-done' takes no arguments"
    # Cap at totalTasks so a repeated call can never report more completed
    # tasks than exist.
    jq_update '
      (.totalTasks // 0) as $total
      | (.completedTasks // 0) as $completed
      | .completedTasks = (if $total > 0 and ($completed + 1) > $total then $total else $completed + 1 end)
      | .updated = $now
    '
    ;;

  set-handoff)
    # Written BEFORE a batch is dispatched (in-progress) and rewritten when a
    # task fails (failed). A session killed mid-batch therefore leaves the
    # in-progress record behind for the next run to find.
    [[ $# -ge 2 ]] \
      || die "'set-handoff' requires at least 2 arguments: <in-progress|failed> \"<note>\" [T00X ...]"
    HANDOFF_STATUS="$1"
    HANDOFF_NOTE="$2"
    shift 2
    [[ "${HANDOFF_STATUS}" == "in-progress" || "${HANDOFF_STATUS}" == "failed" ]] \
      || die "invalid handoff status '${HANDOFF_STATUS}' - must be 'in-progress' or 'failed'"
    [[ -n "${HANDOFF_NOTE}" ]] || die "'set-handoff' requires a non-empty note"
    for task_id in "$@"; do
      [[ "${task_id}" =~ ^T[0-9]+$ ]] \
        || die "invalid task id '${task_id}' - must match T[0-9]+ (e.g. T004)"
    done
    # $ARGS.positional yields [] when no ids were given (light mode).
    HANDOFF_TASKS="$(jq -c -n '$ARGS.positional' --args "$@")"
    jq_update '
      .handoff = { status: $status, tasks: $tasks, note: $note, at: $now }
      | .updated = $now
    ' --arg status "${HANDOFF_STATUS}" --arg note "${HANDOFF_NOTE}" --argjson tasks "${HANDOFF_TASKS}"
    ;;

  clear-handoff)
    [[ $# -eq 0 ]] || die "'clear-handoff' takes no arguments"
    require_state_file
    if jq -e '.handoff' "${STATE_FILE}" >/dev/null 2>&1; then
      jq_update 'del(.handoff) | .updated = $now'
    else
      # Nothing to clear: print the state untouched so callers can treat the
      # operation as idempotent.
      jq '.' "${STATE_FILE}" || die "failed to read '${STATE_FILE}' (invalid JSON?)"
    fi
    ;;

  get)
    [[ $# -eq 0 ]] || die "'get' takes no arguments"
    require_state_file
    jq '.' "${STATE_FILE}" || die "failed to read '${STATE_FILE}' (invalid JSON?)"
    ;;

  *)
    echo "Error: unknown operation '${OPERATION}'" >&2
    usage >&2
    exit 1
    ;;
esac
