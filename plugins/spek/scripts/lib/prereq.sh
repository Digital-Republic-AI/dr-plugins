#!/usr/bin/env bash
# Shared artifact-ordering rules of the spek plugin, used by BOTH writers of
# SDD artifacts: the PreToolUse hook (Write|Edit|MultiEdit by the model) and
# the sdd-templates scaffold script (cp by bash). Keeping the rules here means
# neither path can drift from the other.
#
# Deliberately file-presence based (no state.json parsing) so it stays cheap
# to check from bash; full state validation is the commands' responsibility.

# artifact_write_blocked FEATURE_DIR FILE_NAME
#
# Returns 0 when FILE_NAME may be written inside FEATURE_DIR, or prints the
# reason to stderr and returns 1 when it may not:
#   - baseline.md is frozen once spec.md exists (it is the approved historical
#     record of how the system was before the change);
#   - plan.md requires spec.md (phase "specify");
#   - tasks.md requires plan.md (phase "plan").
# Any other file name is always allowed. Callers decide the exit code: the
# hook exits 2 (blocking), scripts exit 1.
artifact_write_blocked() {
  local feature_dir="$1"
  local file_name="$2"

  case "${file_name}" in
    baseline.md)
      if [[ -f "${feature_dir}/spec.md" ]]; then
        echo "Blocked: 'baseline.md' is immutable once 'spec.md' exists in ${feature_dir}. The baseline is the approved historical record of how the system was before this change - rewriting it would destroy the ability to verify regressions against it. If you need a fresh baseline, create a new feature with /spek:extract instead of editing this one." >&2
        return 1
      fi
      ;;
    plan.md)
      _require_artifact "${feature_dir}" "${file_name}" "spec.md" "specify" || return 1
      ;;
    tasks.md)
      _require_artifact "${feature_dir}" "${file_name}" "plan.md" "plan" || return 1
      ;;
  esac
  return 0
}

# _require_artifact FEATURE_DIR TARGET_FILE REQUIRED_FILE PHASE_LABEL
_require_artifact() {
  local feature_dir="$1" target_file="$2" required_file="$3" phase_label="$4"
  if [[ ! -f "${feature_dir}/${required_file}" ]]; then
    echo "Blocked: '${target_file}' requires '${required_file}' to exist first (phase '${phase_label}' incomplete). Run the corresponding /spek command before editing this file directly." >&2
    return 1
  fi
  return 0
}
